// Command server runs the consensus service.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/chrysalis/go-consensus/pkg/byzantine"
	"github.com/chrysalis/go-consensus/pkg/gossip"
	gosync "github.com/chrysalis/go-consensus/pkg/sync"
	"github.com/chrysalis/go-consensus/pkg/vectorclock"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog"
)

var (
	nodeID   = flag.String("node-id", "", "Unique node identifier")
	addr     = flag.String("addr", ":8080", "Server address")
	peers    = flag.String("peers", "", "Comma-separated peer addresses")
	logLevel = flag.String("log-level", "info", "Log level (debug, info, warn, error)")
)

// WebSocketTransport implements gossip.Transport using WebSockets.
type WebSocketTransport struct {
	connections map[string]*websocket.Conn
	mu          sync.RWMutex
	logger      zerolog.Logger
}

func NewWebSocketTransport(logger zerolog.Logger) *WebSocketTransport {
	return &WebSocketTransport{
		connections: make(map[string]*websocket.Conn),
		logger:      logger,
	}
}

func (t *WebSocketTransport) Send(ctx context.Context, peer *gossip.Peer, msg *gossip.Message) error {
	t.mu.RLock()
	conn, exists := t.connections[peer.ID]
	t.mu.RUnlock()

	if !exists {
		// Establish connection
		var err error
		conn, _, err = websocket.DefaultDialer.DialContext(ctx, "ws://"+peer.Address+"/gossip", nil)
		if err != nil {
			return err
		}
		t.mu.Lock()
		t.connections[peer.ID] = conn
		t.mu.Unlock()
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	return conn.WriteMessage(websocket.TextMessage, data)
}

func (t *WebSocketTransport) Broadcast(ctx context.Context, peers []*gossip.Peer, msg *gossip.Message) error {
	for _, peer := range peers {
		if err := t.Send(ctx, peer, msg); err != nil {
			t.logger.Warn().Err(err).Str("peer", peer.ID).Msg("broadcast send failed")
		}
	}
	return nil
}

// MemoryStore implements gosync.StateStore in memory.
type MemoryStore struct {
	data map[string]json.RawMessage
	mu   sync.RWMutex
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		data: make(map[string]json.RawMessage),
	}
}

func (s *MemoryStore) Get(key string) (json.RawMessage, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.data[key], nil
}

func (s *MemoryStore) Set(key string, value json.RawMessage) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data[key] = value
	return nil
}

func (s *MemoryStore) Delete(key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.data, key)
	return nil
}

func (s *MemoryStore) GetAll() (map[string]json.RawMessage, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make(map[string]json.RawMessage, len(s.data))
	for k, v := range s.data {
		result[k] = v
	}
	return result, nil
}

// StateHandler implements gossip.StateHandler.
type StateHandler struct {
	store  *MemoryStore
	logger zerolog.Logger
}

func (h *StateHandler) OnReceive(ctx context.Context, senderID string, payload json.RawMessage, vc *vectorclock.VectorClock) error {
	h.logger.Debug().Str("sender", senderID).Msg("received state")
	// Store received state
	return h.store.Set("state:"+senderID, payload)
}

func (h *StateHandler) GetState() (json.RawMessage, error) {
	state, err := h.store.GetAll()
	if err != nil {
		return nil, err
	}
	return json.Marshal(state)
}

func (h *StateHandler) GetDigest() ([]byte, error) {
	state, err := h.store.GetAll()
	if err != nil {
		return nil, err
	}
	return json.Marshal(state)
}

func main() {
	flag.Parse()

	// Configure logging
	level, _ := zerolog.ParseLevel(*logLevel)
	logger := zerolog.New(os.Stdout).
		Level(level).
		With().
		Timestamp().
		Str("node", *nodeID).
		Logger()

	if *nodeID == "" {
		logger.Fatal().Msg("node-id is required")
	}

	logger.Info().Str("addr", *addr).Msg("starting consensus server")

	// Initialize components
	store := NewMemoryStore()
	transport := NewWebSocketTransport(logger)
	handler := &StateHandler{store: store, logger: logger}

	gossipConfig := gossip.DefaultConfig(*nodeID)
	gossipProtocol := gossip.New(gossipConfig, transport, handler, logger)

	consensus := byzantine.NewByzantineConsensus(*nodeID, 5, logger) // Assume 5 nodes

	syncConfig := gosync.DefaultSyncConfig()
	coordinator := gosync.NewCoordinator(
		syncConfig,
		"agent-001", // Agent ID
		*nodeID,     // Instance ID
		gossipProtocol,
		consensus,
		store,
		logger,
	)

	// Start services
	coordinator.Start()

	// HTTP/WebSocket server
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	http.HandleFunc("/gossip", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			logger.Error().Err(err).Msg("websocket upgrade failed")
			return
		}
		defer conn.Close()

		for {
			_, data, err := conn.ReadMessage()
			if err != nil {
				break
			}

			var msg gossip.Message
			if err := json.Unmarshal(data, &msg); err != nil {
				logger.Warn().Err(err).Msg("invalid message")
				continue
			}

			if err := gossipProtocol.HandleMessage(r.Context(), &msg); err != nil {
				logger.Error().Err(err).Msg("handle message failed")
			}
		}
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
	})

	http.HandleFunc("/state", func(w http.ResponseWriter, r *http.Request) {
		state, err := store.GetAll()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(state)
	})

	http.HandleFunc("/sync", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var event gosync.SyncEvent
		if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if err := coordinator.PublishEvent(&event); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusAccepted)
	})

	// Start server
	server := &http.Server{Addr: *addr}
	go func() {
		if err := server.ListenAndServe(); err != http.ErrServerClosed {
			logger.Fatal().Err(err).Msg("server failed")
		}
	}()

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	logger.Info().Msg("shutting down")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	coordinator.Stop()
	server.Shutdown(ctx)
}