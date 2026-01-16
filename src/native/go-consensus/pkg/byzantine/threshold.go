// Package byzantine implements Byzantine fault-tolerant consensus mechanisms.
package byzantine

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"sync"
	"time"

	"github.com/chrysalis/go-consensus/pkg/vectorclock"
	"github.com/rs/zerolog"
)

var (
	ErrInsufficientVotes = errors.New("insufficient votes for consensus")
	ErrTimeout           = errors.New("consensus timeout")
	ErrConflictingVotes  = errors.New("conflicting votes detected")
)

// Vote represents a vote from a node in the consensus process.
type Vote struct {
	NodeID      string                  `json:"node_id"`
	Value       json.RawMessage         `json:"value"`
	VectorClock *vectorclock.VectorClock `json:"vector_clock"`
	Signature   []byte                  `json:"signature,omitempty"`
	Timestamp   time.Time               `json:"timestamp"`
}

// ConsensusResult holds the outcome of a consensus round.
type ConsensusResult struct {
	Achieved    bool            `json:"achieved"`
	Value       json.RawMessage `json:"value,omitempty"`
	VoteCount   int             `json:"vote_count"`
	TotalNodes  int             `json:"total_nodes"`
	Round       uint64          `json:"round"`
	Duration    time.Duration   `json:"duration"`
}

// ThresholdVoting implements 2/3 supermajority Byzantine consensus.
type ThresholdVoting struct {
	nodeID      string
	totalNodes  int
	threshold   int // Required votes (2f+1 where f = max Byzantine nodes)

	currentRound uint64
	votes        map[uint64]map[string]*Vote
	results      map[uint64]*ConsensusResult
	mu           sync.RWMutex

	logger zerolog.Logger
}

// NewThresholdVoting creates a new threshold voting instance.
func NewThresholdVoting(nodeID string, totalNodes int, logger zerolog.Logger) *ThresholdVoting {
	// Byzantine tolerance: f = (n-1)/3, threshold = 2f+1 = (2n+1)/3
	// Simplified: we need more than 2/3 of votes
	threshold := (2*totalNodes + 2) / 3

	return &ThresholdVoting{
		nodeID:     nodeID,
		totalNodes: totalNodes,
		threshold:  threshold,
		votes:      make(map[uint64]map[string]*Vote),
		results:    make(map[uint64]*ConsensusResult),
		logger:     logger.With().Str("component", "byzantine").Logger(),
	}
}

// StartRound initiates a new consensus round.
func (tv *ThresholdVoting) StartRound() uint64 {
	tv.mu.Lock()
	defer tv.mu.Unlock()

	tv.currentRound++
	tv.votes[tv.currentRound] = make(map[string]*Vote)
	tv.logger.Info().Uint64("round", tv.currentRound).Msg("started new consensus round")
	return tv.currentRound
}

// CastVote records a vote for the current round.
func (tv *ThresholdVoting) CastVote(round uint64, vote *Vote) error {
	tv.mu.Lock()
	defer tv.mu.Unlock()

	roundVotes, exists := tv.votes[round]
	if !exists {
		return errors.New("round does not exist")
	}

	// Check for duplicate or conflicting vote from same node
	if existing, hasVoted := roundVotes[vote.NodeID]; hasVoted {
		if string(existing.Value) != string(vote.Value) {
			tv.logger.Warn().
				Str("node", vote.NodeID).
				Uint64("round", round).
				Msg("conflicting vote detected")
			return ErrConflictingVotes
		}
		return nil // Duplicate vote, ignore
	}

	roundVotes[vote.NodeID] = vote
	tv.logger.Debug().
		Str("node", vote.NodeID).
		Uint64("round", round).
		Int("votes", len(roundVotes)).
		Msg("vote recorded")

	return nil
}

// CheckConsensus checks if consensus has been reached for a round.
func (tv *ThresholdVoting) CheckConsensus(round uint64) (*ConsensusResult, error) {
	tv.mu.RLock()
	defer tv.mu.RUnlock()

	roundVotes, exists := tv.votes[round]
	if !exists {
		return nil, errors.New("round does not exist")
	}

	// Group votes by value
	valueCounts := make(map[string]int)
	valueVotes := make(map[string][]*Vote)

	for _, vote := range roundVotes {
		key := string(vote.Value)
		valueCounts[key]++
		valueVotes[key] = append(valueVotes[key], vote)
	}

	// Check if any value has reached threshold
	for value, count := range valueCounts {
		if count >= tv.threshold {
			result := &ConsensusResult{
				Achieved:   true,
				Value:      json.RawMessage(value),
				VoteCount:  count,
				TotalNodes: tv.totalNodes,
				Round:      round,
			}
			return result, nil
		}
	}

	// No consensus yet
	return &ConsensusResult{
		Achieved:   false,
		VoteCount:  len(roundVotes),
		TotalNodes: tv.totalNodes,
		Round:      round,
	}, nil
}

// WaitForConsensus blocks until consensus is reached or timeout.
func (tv *ThresholdVoting) WaitForConsensus(ctx context.Context, round uint64) (*ConsensusResult, error) {
	startTime := time.Now()
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil, ErrTimeout

		case <-ticker.C:
			result, err := tv.CheckConsensus(round)
			if err != nil {
				return nil, err
			}
			if result.Achieved {
				result.Duration = time.Since(startTime)
				return result, nil
			}
		}
	}
}

// GetVotes returns all votes for a round.
func (tv *ThresholdVoting) GetVotes(round uint64) []*Vote {
	tv.mu.RLock()
	defer tv.mu.RUnlock()

	roundVotes, exists := tv.votes[round]
	if !exists {
		return nil
	}

	votes := make([]*Vote, 0, len(roundVotes))
	for _, v := range roundVotes {
		votes = append(votes, v)
	}
	return votes
}

// MedianAggregator aggregates numeric values using median (Byzantine-resistant).
type MedianAggregator struct {
	values []float64
	mu     sync.Mutex
}

// NewMedianAggregator creates a new median aggregator.
func NewMedianAggregator() *MedianAggregator {
	return &MedianAggregator{
		values: make([]float64, 0),
	}
}

// Add adds a value to the aggregator.
func (ma *MedianAggregator) Add(value float64) {
	ma.mu.Lock()
	defer ma.mu.Unlock()
	ma.values = append(ma.values, value)
}

// Median returns the median value.
func (ma *MedianAggregator) Median() (float64, error) {
	ma.mu.Lock()
	defer ma.mu.Unlock()

	if len(ma.values) == 0 {
		return 0, errors.New("no values")
	}

	sorted := make([]float64, len(ma.values))
	copy(sorted, ma.values)
	sort.Float64s(sorted)

	n := len(sorted)
	if n%2 == 0 {
		return (sorted[n/2-1] + sorted[n/2]) / 2, nil
	}
	return sorted[n/2], nil
}

// TrimmedMean returns the mean after removing outliers (Byzantine-resistant).
func (ma *MedianAggregator) TrimmedMean(trimPercent float64) (float64, error) {
	ma.mu.Lock()
	defer ma.mu.Unlock()

	n := len(ma.values)
	if n == 0 {
		return 0, errors.New("no values")
	}

	sorted := make([]float64, n)
	copy(sorted, ma.values)
	sort.Float64s(sorted)

	// Trim extreme values
	trimCount := int(float64(n) * trimPercent / 2)
	if trimCount*2 >= n {
		trimCount = 0
	}

	trimmed := sorted[trimCount : n-trimCount]
	if len(trimmed) == 0 {
		return 0, errors.New("all values trimmed")
	}

	var sum float64
	for _, v := range trimmed {
		sum += v
	}
	return sum / float64(len(trimmed)), nil
}

// Reset clears the aggregator.
func (ma *MedianAggregator) Reset() {
	ma.mu.Lock()
	defer ma.mu.Unlock()
	ma.values = ma.values[:0]
}

// Count returns the number of values.
func (ma *MedianAggregator) Count() int {
	ma.mu.Lock()
	defer ma.mu.Unlock()
	return len(ma.values)
}

// ByzantineConsensus coordinates full Byzantine consensus protocol.
type ByzantineConsensus struct {
	voting   *ThresholdVoting
	nodeID   string
	logger   zerolog.Logger

	// Proposal tracking
	proposals   map[uint64]json.RawMessage
	proposalsMu sync.RWMutex
}

// NewByzantineConsensus creates a new Byzantine consensus coordinator.
func NewByzantineConsensus(nodeID string, totalNodes int, logger zerolog.Logger) *ByzantineConsensus {
	return &ByzantineConsensus{
		voting:    NewThresholdVoting(nodeID, totalNodes, logger),
		nodeID:    nodeID,
		logger:    logger,
		proposals: make(map[uint64]json.RawMessage),
	}
}

// Propose initiates a consensus round with a proposed value.
func (bc *ByzantineConsensus) Propose(ctx context.Context, value json.RawMessage) (*ConsensusResult, error) {
	round := bc.voting.StartRound()

	bc.proposalsMu.Lock()
	bc.proposals[round] = value
	bc.proposalsMu.Unlock()

	// Cast our own vote
	vote := &Vote{
		NodeID:      bc.nodeID,
		Value:       value,
		VectorClock: vectorclock.NewWithNode(bc.nodeID),
		Timestamp:   time.Now(),
	}

	if err := bc.voting.CastVote(round, vote); err != nil {
		return nil, err
	}

	bc.logger.Info().
		Uint64("round", round).
		Msg("proposal submitted")

	return &ConsensusResult{
		Achieved: false,
		Round:    round,
	}, nil
}

// ReceiveVote processes an incoming vote.
func (bc *ByzantineConsensus) ReceiveVote(vote *Vote, round uint64) error {
	return bc.voting.CastVote(round, vote)
}

// CheckResult checks the current consensus status.
func (bc *ByzantineConsensus) CheckResult(round uint64) (*ConsensusResult, error) {
	return bc.voting.CheckConsensus(round)
}

// WaitForResult waits for consensus with timeout.
func (bc *ByzantineConsensus) WaitForResult(ctx context.Context, round uint64) (*ConsensusResult, error) {
	return bc.voting.WaitForConsensus(ctx, round)
}