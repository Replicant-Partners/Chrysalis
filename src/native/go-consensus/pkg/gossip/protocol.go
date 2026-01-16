// Package gossip implements an epidemic gossip protocol for distributed state synchronization.
package gossip

import (
	"context"
	"encoding/json"
	"math/rand"
	"sync"
	"time"

	"github.com/chrysalis/go-consensus/pkg/vectorclock"
	"github.com/rs/zerolog"
	"golang.org/x/sync/semaphore"
)

// MessageType identifies the type of gossip message.
type MessageType string

const (
	MessageTypePush   MessageType = "push"   // Send state to peer
	MessageTypePull   MessageType = "pull"   // Request state from peer
	MessageTypeAck    MessageType = "ack"    // Acknowledge receipt
	MessageTypeDigest MessageType = "digest" // Send state digest for comparison
)

// Message represents a gossip protocol message.
type Message struct {
	ID          string                  `json:"id"`
	Type        MessageType             `json:"type"`
	SenderID    string                  `json:"sender_id"`
	VectorClock *vectorclock.VectorClock `json:"vector_clock"`
	Payload     json.RawMessage         `json:"payload,omitempty"`
	Timestamp   time.Time               `json:"timestamp"`
	TTL         int                     `json:"ttl"` // Time-to-live (hop count)
}

// Peer represents a remote node in the gossip network.
type Peer struct {
	ID        string
	Address   string
	LastSeen  time.Time
	Latency   time.Duration
	FailCount int
	mu        sync.RWMutex
}

// UpdateLastSeen updates the last seen time for the peer.
func (p *Peer) UpdateLastSeen() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.LastSeen = time.Now()
	p.FailCount = 0
}

// RecordFailure records a failure for the peer.
func (p *Peer) RecordFailure() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.FailCount++
}

// IsHealthy returns true if the peer is considered healthy.
func (p *Peer) IsHealthy() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.FailCount < 3 && time.Since(p.LastSeen) < 5*time.Minute
}

// Transport defines the interface for sending gossip messages.
type Transport interface {
	Send(ctx context.Context, peer *Peer, msg *Message) error
	Broadcast(ctx context.Context, peers []*Peer, msg *Message) error
}

// StateHandler processes incoming state updates.
type StateHandler interface {
	// OnReceive is called when state is received from a peer.
	OnReceive(ctx context.Context, senderID string, payload json.RawMessage, vc *vectorclock.VectorClock) error
	// GetState returns the current state for sending to peers.
	GetState() (json.RawMessage, error)
	// GetDigest returns a compact digest of the current state.
	GetDigest() ([]byte, error)
}

// Config holds gossip protocol configuration.
type Config struct {
	NodeID           string        // This node's unique ID
	FanOut           int           // Number of peers to gossip to each round
	GossipInterval   time.Duration // Time between gossip rounds
	MaxTTL           int           // Maximum message hop count
	MaxConcurrent    int           // Maximum concurrent sends
	PushPullInterval time.Duration // Interval for push-pull synchronization
}

// DefaultConfig returns sensible default configuration.
func DefaultConfig(nodeID string) *Config {
	return &Config{
		NodeID:           nodeID,
		FanOut:           3,
		GossipInterval:   100 * time.Millisecond,
		MaxTTL:           5,
		MaxConcurrent:    10,
		PushPullInterval: time.Second,
	}
}

// Protocol implements the gossip protocol.
type Protocol struct {
	config  *Config
	peers   map[string]*Peer
	peersMu sync.RWMutex

	vectorClock *vectorclock.VectorClock
	clockMu     sync.RWMutex

	transport Transport
	handler   StateHandler
	logger    zerolog.Logger

	// Bounded concurrency for sending
	sendSem *semaphore.Weighted

	// Deduplication of seen messages
	seenMsgs   map[string]time.Time
	seenMsgsMu sync.RWMutex

	// Shutdown
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// New creates a new gossip protocol instance.
func New(config *Config, transport Transport, handler StateHandler, logger zerolog.Logger) *Protocol {
	ctx, cancel := context.WithCancel(context.Background())
	return &Protocol{
		config:      config,
		peers:       make(map[string]*Peer),
		vectorClock: vectorclock.NewWithNode(config.NodeID),
		transport:   transport,
		handler:     handler,
		logger:      logger.With().Str("component", "gossip").Logger(),
		sendSem:     semaphore.NewWeighted(int64(config.MaxConcurrent)),
		seenMsgs:    make(map[string]time.Time),
		ctx:         ctx,
		cancel:      cancel,
	}
}

// AddPeer adds a peer to the gossip network.
func (p *Protocol) AddPeer(id, address string) {
	p.peersMu.Lock()
	defer p.peersMu.Unlock()

	if _, exists := p.peers[id]; !exists {
		p.peers[id] = &Peer{
			ID:       id,
			Address:  address,
			LastSeen: time.Now(),
		}
		p.logger.Info().Str("peer_id", id).Str("address", address).Msg("peer added")
	}
}

// RemovePeer removes a peer from the gossip network.
func (p *Protocol) RemovePeer(id string) {
	p.peersMu.Lock()
	defer p.peersMu.Unlock()
	delete(p.peers, id)
	p.logger.Info().Str("peer_id", id).Msg("peer removed")
}

// GetPeers returns all known peers.
func (p *Protocol) GetPeers() []*Peer {
	p.peersMu.RLock()
	defer p.peersMu.RUnlock()

	peers := make([]*Peer, 0, len(p.peers))
	for _, peer := range p.peers {
		peers = append(peers, peer)
	}
	return peers
}

// selectRandomPeers selects random healthy peers for gossip.
func (p *Protocol) selectRandomPeers(n int) []*Peer {
	p.peersMu.RLock()
	defer p.peersMu.RUnlock()

	// Filter healthy peers
	healthy := make([]*Peer, 0, len(p.peers))
	for _, peer := range p.peers {
		if peer.IsHealthy() {
			healthy = append(healthy, peer)
		}
	}

	// Shuffle and select
	rand.Shuffle(len(healthy), func(i, j int) {
		healthy[i], healthy[j] = healthy[j], healthy[i]
	})

	if n > len(healthy) {
		n = len(healthy)
	}
	return healthy[:n]
}

// Tick increments the local vector clock.
func (p *Protocol) Tick() {
	p.clockMu.Lock()
	defer p.clockMu.Unlock()
	p.vectorClock.Increment(p.config.NodeID)
}

// GetVectorClock returns a copy of the current vector clock.
func (p *Protocol) GetVectorClock() *vectorclock.VectorClock {
	p.clockMu.RLock()
	defer p.clockMu.RUnlock()
	return p.vectorClock.Clone()
}

// hasSeen checks if a message has been seen and marks it as seen.
func (p *Protocol) hasSeen(msgID string) bool {
	p.seenMsgsMu.Lock()
	defer p.seenMsgsMu.Unlock()

	if _, seen := p.seenMsgs[msgID]; seen {
		return true
	}
	p.seenMsgs[msgID] = time.Now()
	return false
}

// cleanupSeenMessages removes old entries from the seen messages map.
func (p *Protocol) cleanupSeenMessages() {
	p.seenMsgsMu.Lock()
	defer p.seenMsgsMu.Unlock()

	cutoff := time.Now().Add(-5 * time.Minute)
	for id, seen := range p.seenMsgs {
		if seen.Before(cutoff) {
			delete(p.seenMsgs, id)
		}
	}
}

// Broadcast sends state to random peers (epidemic spreading).
func (p *Protocol) Broadcast(ctx context.Context, payload json.RawMessage) error {
	p.Tick()

	msg := &Message{
		ID:          generateMessageID(),
		Type:        MessageTypePush,
		SenderID:    p.config.NodeID,
		VectorClock: p.GetVectorClock(),
		Payload:     payload,
		Timestamp:   time.Now(),
		TTL:         p.config.MaxTTL,
	}

	peers := p.selectRandomPeers(p.config.FanOut)
	return p.sendToMultiple(ctx, peers, msg)
}

// sendToMultiple sends a message to multiple peers with bounded concurrency.
func (p *Protocol) sendToMultiple(ctx context.Context, peers []*Peer, msg *Message) error {
	var wg sync.WaitGroup
	errCh := make(chan error, len(peers))

	for _, peer := range peers {
		peer := peer // capture for goroutine

		// Acquire semaphore
		if err := p.sendSem.Acquire(ctx, 1); err != nil {
			return err
		}

		wg.Add(1)
		go func() {
			defer wg.Done()
			defer p.sendSem.Release(1)

			if err := p.transport.Send(ctx, peer, msg); err != nil {
				peer.RecordFailure()
				errCh <- err
				p.logger.Warn().Err(err).Str("peer", peer.ID).Msg("send failed")
			} else {
				peer.UpdateLastSeen()
			}
		}()
	}

	wg.Wait()
	close(errCh)

	// Return first error if any
	for err := range errCh {
		if err != nil {
			return err
		}
	}
	return nil
}

// HandleMessage processes an incoming gossip message.
func (p *Protocol) HandleMessage(ctx context.Context, msg *Message) error {
	// Check TTL
	if msg.TTL <= 0 {
		return nil
	}

	// Deduplication
	if p.hasSeen(msg.ID) {
		return nil
	}

	p.logger.Debug().
		Str("msg_id", msg.ID).
		Str("sender", msg.SenderID).
		Str("type", string(msg.Type)).
		Int("ttl", msg.TTL).
		Msg("received message")

	// Update local vector clock
	p.clockMu.Lock()
	p.vectorClock.Merge(msg.VectorClock)
	p.vectorClock.Increment(p.config.NodeID)
	p.clockMu.Unlock()

	// Process based on message type
	switch msg.Type {
	case MessageTypePush:
		if err := p.handler.OnReceive(ctx, msg.SenderID, msg.Payload, msg.VectorClock); err != nil {
			return err
		}
		// Continue epidemic spreading with decremented TTL
		if msg.TTL > 1 {
			forwardMsg := *msg
			forwardMsg.TTL--
			peers := p.selectRandomPeers(p.config.FanOut)
			// Filter out the sender
			filtered := make([]*Peer, 0, len(peers))
			for _, peer := range peers {
				if peer.ID != msg.SenderID {
					filtered = append(filtered, peer)
				}
			}
			if len(filtered) > 0 {
				go p.sendToMultiple(ctx, filtered, &forwardMsg)
			}
		}

	case MessageTypePull:
		// Respond with our current state
		state, err := p.handler.GetState()
		if err != nil {
			return err
		}
		response := &Message{
			ID:          generateMessageID(),
			Type:        MessageTypePush,
			SenderID:    p.config.NodeID,
			VectorClock: p.GetVectorClock(),
			Payload:     state,
			Timestamp:   time.Now(),
			TTL:         1, // Direct response, no forwarding
		}
		p.peersMu.RLock()
		sender, exists := p.peers[msg.SenderID]
		p.peersMu.RUnlock()
		if exists {
			go p.transport.Send(ctx, sender, response)
		}

	case MessageTypeAck:
		// Acknowledgment received, nothing to do

	case MessageTypeDigest:
		// Compare digests and request full state if different
		// (Implementation depends on specific use case)
	}

	return nil
}

// Start begins the gossip protocol background tasks.
func (p *Protocol) Start() {
	// Periodic gossip rounds
	p.wg.Add(1)
	go func() {
		defer p.wg.Done()
		ticker := time.NewTicker(p.config.GossipInterval)
		defer ticker.Stop()

		for {
			select {
			case <-p.ctx.Done():
				return
			case <-ticker.C:
				p.doGossipRound()
			}
		}
	}()

	// Periodic push-pull synchronization
	p.wg.Add(1)
	go func() {
		defer p.wg.Done()
		ticker := time.NewTicker(p.config.PushPullInterval)
		defer ticker.Stop()

		for {
			select {
			case <-p.ctx.Done():
				return
			case <-ticker.C:
				p.doPushPull()
			}
		}
	}()

	// Periodic cleanup of seen messages
	p.wg.Add(1)
	go func() {
		defer p.wg.Done()
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()

		for {
			select {
			case <-p.ctx.Done():
				return
			case <-ticker.C:
				p.cleanupSeenMessages()
			}
		}
	}()

	p.logger.Info().Msg("gossip protocol started")
}

// doGossipRound performs a single gossip round.
func (p *Protocol) doGossipRound() {
	state, err := p.handler.GetState()
	if err != nil {
		p.logger.Error().Err(err).Msg("failed to get state for gossip")
		return
	}

	if err := p.Broadcast(p.ctx, state); err != nil {
		p.logger.Warn().Err(err).Msg("gossip round failed")
	}
}

// doPushPull performs push-pull synchronization with a random peer.
func (p *Protocol) doPushPull() {
	peers := p.selectRandomPeers(1)
	if len(peers) == 0 {
		return
	}

	peer := peers[0]

	// Send pull request
	msg := &Message{
		ID:          generateMessageID(),
		Type:        MessageTypePull,
		SenderID:    p.config.NodeID,
		VectorClock: p.GetVectorClock(),
		Timestamp:   time.Now(),
		TTL:         1,
	}

	if err := p.transport.Send(p.ctx, peer, msg); err != nil {
		p.logger.Warn().Err(err).Str("peer", peer.ID).Msg("push-pull failed")
		peer.RecordFailure()
	}
}

// Stop gracefully shuts down the gossip protocol.
func (p *Protocol) Stop() {
	p.cancel()
	p.wg.Wait()
	p.logger.Info().Msg("gossip protocol stopped")
}

// generateMessageID creates a unique message identifier.
func generateMessageID() string {
	return time.Now().Format("20060102150405.000000") + "-" + randomString(8)
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}