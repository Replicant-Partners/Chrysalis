// Package sync provides synchronization primitives for distributed state management.
package sync

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/chrysalis/go-consensus/pkg/byzantine"
	"github.com/chrysalis/go-consensus/pkg/gossip"
	"github.com/chrysalis/go-consensus/pkg/vectorclock"
	"github.com/rs/zerolog"
)

// SyncProtocol defines the synchronization strategy.
type SyncProtocol string

const (
	ProtocolStreaming SyncProtocol = "streaming" // Real-time event streaming
	ProtocolLumped    SyncProtocol = "lumped"    // Batched updates
	ProtocolCheckIn   SyncProtocol = "check_in"  // Periodic full state sync
)

// SyncEvent represents a state change event.
type SyncEvent struct {
	ID          string          `json:"id"`
	Type        string          `json:"type"`
	AgentID     string          `json:"agent_id"`
	InstanceID  string          `json:"instance_id"`
	Payload     json.RawMessage `json:"payload"`
	VectorClock *vectorclock.VectorClock `json:"vector_clock"`
	Timestamp   time.Time       `json:"timestamp"`
	Priority    int             `json:"priority"` // 0-10, higher = more important
}

// MergeStrategy defines how to resolve conflicts.
type MergeStrategy string

const (
	MergeLastWriterWins MergeStrategy = "lww"        // Last writer wins
	MergeVectorClock    MergeStrategy = "vc"         // Vector clock ordering
	MergeConsensus      MergeStrategy = "consensus"  // Byzantine consensus
	MergeCRDT           MergeStrategy = "crdt"       // CRDT merge
)

// SyncConfig holds synchronization configuration.
type SyncConfig struct {
	Protocol         SyncProtocol  `json:"protocol"`
	MergeStrategy    MergeStrategy `json:"merge_strategy"`
	BatchSize        int           `json:"batch_size"`
	BatchTimeout     time.Duration `json:"batch_timeout"`
	CheckInInterval  time.Duration `json:"check_in_interval"`
	PriorityThreshold int          `json:"priority_threshold"`
}

// DefaultSyncConfig returns default configuration.
func DefaultSyncConfig() *SyncConfig {
	return &SyncConfig{
		Protocol:         ProtocolStreaming,
		MergeStrategy:    MergeCRDT,
		BatchSize:        100,
		BatchTimeout:     time.Second,
		CheckInInterval:  5 * time.Minute,
		PriorityThreshold: 5,
	}
}

// StateStore interface for state persistence.
type StateStore interface {
	Get(key string) (json.RawMessage, error)
	Set(key string, value json.RawMessage) error
	Delete(key string) error
	GetAll() (map[string]json.RawMessage, error)
}

// Coordinator manages distributed state synchronization.
type Coordinator struct {
	config    *SyncConfig
	agentID   string
	instanceID string

	gossip    *gossip.Protocol
	consensus *byzantine.ByzantineConsensus
	store     StateStore

	vectorClock *vectorclock.VectorClock
	clockMu     sync.RWMutex

	// Event batching
	eventBatch   []*SyncEvent
	batchMu      sync.Mutex
	batchTimer   *time.Timer

	// Subscribers
	subscribers   []chan *SyncEvent
	subscribersMu sync.RWMutex

	logger zerolog.Logger
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// NewCoordinator creates a new sync coordinator.
func NewCoordinator(
	config *SyncConfig,
	agentID, instanceID string,
	gossipProtocol *gossip.Protocol,
	consensus *byzantine.ByzantineConsensus,
	store StateStore,
	logger zerolog.Logger,
) *Coordinator {
	ctx, cancel := context.WithCancel(context.Background())
	return &Coordinator{
		config:      config,
		agentID:     agentID,
		instanceID:  instanceID,
		gossip:      gossipProtocol,
		consensus:   consensus,
		store:       store,
		vectorClock: vectorclock.NewWithNode(instanceID),
		eventBatch:  make([]*SyncEvent, 0, config.BatchSize),
		subscribers: make([]chan *SyncEvent, 0),
		logger:      logger.With().Str("component", "sync-coordinator").Logger(),
		ctx:         ctx,
		cancel:      cancel,
	}
}

// Start begins synchronization.
func (c *Coordinator) Start() {
	// Start gossip if available
	if c.gossip != nil {
		c.gossip.Start()
	}

	// Start check-in loop if using check-in protocol
	if c.config.Protocol == ProtocolCheckIn {
		c.wg.Add(1)
		go c.checkInLoop()
	}

	c.logger.Info().
		Str("protocol", string(c.config.Protocol)).
		Str("merge_strategy", string(c.config.MergeStrategy)).
		Msg("sync coordinator started")
}

// Stop gracefully shuts down synchronization.
func (c *Coordinator) Stop() {
	c.cancel()

	// Flush any pending batch
	c.flushBatch()

	if c.gossip != nil {
		c.gossip.Stop()
	}

	c.wg.Wait()

	// Close all subscriber channels
	c.subscribersMu.Lock()
	for _, ch := range c.subscribers {
		close(ch)
	}
	c.subscribers = nil
	c.subscribersMu.Unlock()

	c.logger.Info().Msg("sync coordinator stopped")
}

// Subscribe returns a channel for receiving sync events.
func (c *Coordinator) Subscribe() <-chan *SyncEvent {
	ch := make(chan *SyncEvent, 100)
	c.subscribersMu.Lock()
	c.subscribers = append(c.subscribers, ch)
	c.subscribersMu.Unlock()
	return ch
}

// Unsubscribe removes a subscriber channel.
func (c *Coordinator) Unsubscribe(ch <-chan *SyncEvent) {
	c.subscribersMu.Lock()
	defer c.subscribersMu.Unlock()

	for i, sub := range c.subscribers {
		if sub == ch {
			close(sub)
			c.subscribers = append(c.subscribers[:i], c.subscribers[i+1:]...)
			return
		}
	}
}

// PublishEvent sends an event to all sync channels.
func (c *Coordinator) PublishEvent(event *SyncEvent) error {
	// Update vector clock
	c.clockMu.Lock()
	c.vectorClock.Increment(c.instanceID)
	event.VectorClock = c.vectorClock.Clone()
	c.clockMu.Unlock()

	// Set metadata
	event.AgentID = c.agentID
	event.InstanceID = c.instanceID
	event.Timestamp = time.Now()
	if event.ID == "" {
		event.ID = generateEventID()
	}

	switch c.config.Protocol {
	case ProtocolStreaming:
		return c.publishStreaming(event)
	case ProtocolLumped:
		return c.publishLumped(event)
	case ProtocolCheckIn:
		// Events are stored and synced on check-in
		return c.storeEvent(event)
	}

	return nil
}

// publishStreaming sends event immediately if above priority threshold.
func (c *Coordinator) publishStreaming(event *SyncEvent) error {
	if event.Priority >= c.config.PriorityThreshold {
		// High priority: send immediately
		return c.broadcastEvent(event)
	}
	// Low priority: batch
	return c.publishLumped(event)
}

// publishLumped adds event to batch.
func (c *Coordinator) publishLumped(event *SyncEvent) error {
	c.batchMu.Lock()
	defer c.batchMu.Unlock()

	c.eventBatch = append(c.eventBatch, event)

	// Start batch timer if this is the first event
	if len(c.eventBatch) == 1 {
		c.batchTimer = time.AfterFunc(c.config.BatchTimeout, func() {
			c.flushBatch()
		})
	}

	// Flush if batch is full
	if len(c.eventBatch) >= c.config.BatchSize {
		c.flushBatchLocked()
	}

	return nil
}

// flushBatch sends all batched events.
func (c *Coordinator) flushBatch() {
	c.batchMu.Lock()
	defer c.batchMu.Unlock()
	c.flushBatchLocked()
}

func (c *Coordinator) flushBatchLocked() {
	if c.batchTimer != nil {
		c.batchTimer.Stop()
		c.batchTimer = nil
	}

	if len(c.eventBatch) == 0 {
		return
	}

	batch := c.eventBatch
	c.eventBatch = make([]*SyncEvent, 0, c.config.BatchSize)

	// Send batch via gossip
	go func() {
		data, err := json.Marshal(batch)
		if err != nil {
			c.logger.Error().Err(err).Msg("failed to marshal batch")
			return
		}
		if err := c.gossip.Broadcast(c.ctx, data); err != nil {
			c.logger.Error().Err(err).Msg("failed to broadcast batch")
		}
	}()
}

// broadcastEvent sends a single event via gossip.
func (c *Coordinator) broadcastEvent(event *SyncEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return c.gossip.Broadcast(c.ctx, data)
}

// storeEvent persists event for later sync.
func (c *Coordinator) storeEvent(event *SyncEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return c.store.Set("event:"+event.ID, data)
}

// ReceiveEvent processes an incoming event from another instance.
func (c *Coordinator) ReceiveEvent(event *SyncEvent) error {
	// Update vector clock
	c.clockMu.Lock()
	c.vectorClock.Merge(event.VectorClock)
	c.vectorClock.Increment(c.instanceID)
	c.clockMu.Unlock()

	// Notify subscribers
	c.subscribersMu.RLock()
	for _, ch := range c.subscribers {
		select {
		case ch <- event:
		default:
			// Channel full, skip
			c.logger.Warn().Msg("subscriber channel full, dropping event")
		}
	}
	c.subscribersMu.RUnlock()

	return nil
}

// checkInLoop performs periodic full state synchronization.
func (c *Coordinator) checkInLoop() {
	defer c.wg.Done()
	ticker := time.NewTicker(c.config.CheckInInterval)
	defer ticker.Stop()

	for {
		select {
		case <-c.ctx.Done():
			return
		case <-ticker.C:
			c.doCheckIn()
		}
	}
}

// doCheckIn performs a full state check-in.
func (c *Coordinator) doCheckIn() {
	c.logger.Debug().Msg("performing check-in")

	// Get all stored state
	state, err := c.store.GetAll()
	if err != nil {
		c.logger.Error().Err(err).Msg("failed to get state for check-in")
		return
	}

	// Broadcast full state
	data, err := json.Marshal(state)
	if err != nil {
		c.logger.Error().Err(err).Msg("failed to marshal state")
		return
	}

	if err := c.gossip.Broadcast(c.ctx, data); err != nil {
		c.logger.Error().Err(err).Msg("failed to broadcast check-in")
	}
}

// ResolveConflict resolves a conflict using the configured merge strategy.
func (c *Coordinator) ResolveConflict(
	ctx context.Context,
	local, remote json.RawMessage,
	localVC, remoteVC *vectorclock.VectorClock,
) (json.RawMessage, error) {
	switch c.config.MergeStrategy {
	case MergeLastWriterWins:
		// Compare by timestamp (from vector clock sum as proxy)
		if localVC.Sum() >= remoteVC.Sum() {
			return local, nil
		}
		return remote, nil

	case MergeVectorClock:
		cmp := localVC.Compare(remoteVC)
		switch cmp {
		case vectorclock.After, vectorclock.Equal:
			return local, nil
		case vectorclock.Before:
			return remote, nil
		case vectorclock.Concurrent:
			// Concurrent: need tiebreaker
			if localVC.Sum() >= remoteVC.Sum() {
				return local, nil
			}
			return remote, nil
		}

	case MergeConsensus:
		// Use Byzantine consensus
		result, err := c.consensus.Propose(ctx, local)
		if err != nil {
			return nil, err
		}
		if result.Achieved {
			return result.Value, nil
		}
		// If no consensus yet, wait or fallback
		result, err = c.consensus.WaitForResult(ctx, result.Round)
		if err != nil {
			return nil, err
		}
		return result.Value, nil

	case MergeCRDT:
		// CRDT merge should be handled at the data layer
		// Return both for the caller to merge
		return local, nil
	}

	return local, nil
}

// GetVectorClock returns the current vector clock.
func (c *Coordinator) GetVectorClock() *vectorclock.VectorClock {
	c.clockMu.RLock()
	defer c.clockMu.RUnlock()
	return c.vectorClock.Clone()
}

// generateEventID creates a unique event identifier.
func generateEventID() string {
	return time.Now().Format("20060102150405.000000000")
}