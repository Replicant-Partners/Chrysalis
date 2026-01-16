// Package vectorclock implements vector clocks for distributed causality tracking.
package vectorclock

import (
	"encoding/json"
	"sync"
)

// Comparison represents the relationship between two vector clocks.
type Comparison int

const (
	Before     Comparison = iota // vc1 happened before vc2
	After                        // vc1 happened after vc2
	Concurrent                   // vc1 and vc2 are concurrent
	Equal                        // vc1 equals vc2
)

// VectorClock tracks causality in a distributed system.
type VectorClock struct {
	mu     sync.RWMutex
	clocks map[string]uint64
}

// New creates a new empty vector clock.
func New() *VectorClock {
	return &VectorClock{
		clocks: make(map[string]uint64),
	}
}

// NewWithNode creates a vector clock initialized for a specific node.
func NewWithNode(nodeID string) *VectorClock {
	vc := New()
	vc.clocks[nodeID] = 0
	return vc
}

// Clone creates a deep copy of the vector clock.
func (vc *VectorClock) Clone() *VectorClock {
	vc.mu.RLock()
	defer vc.mu.RUnlock()

	clone := New()
	for k, v := range vc.clocks {
		clone.clocks[k] = v
	}
	return clone
}

// Increment increases the clock for the given node.
func (vc *VectorClock) Increment(nodeID string) {
	vc.mu.Lock()
	defer vc.mu.Unlock()
	vc.clocks[nodeID]++
}

// Get returns the clock value for a node.
func (vc *VectorClock) Get(nodeID string) uint64 {
	vc.mu.RLock()
	defer vc.mu.RUnlock()
	return vc.clocks[nodeID]
}

// Set sets the clock value for a node.
func (vc *VectorClock) Set(nodeID string, value uint64) {
	vc.mu.Lock()
	defer vc.mu.Unlock()
	vc.clocks[nodeID] = value
}

// Merge combines two vector clocks by taking the maximum of each component.
func (vc *VectorClock) Merge(other *VectorClock) {
	vc.mu.Lock()
	defer vc.mu.Unlock()
	other.mu.RLock()
	defer other.mu.RUnlock()

	for nodeID, otherTime := range other.clocks {
		if currentTime, exists := vc.clocks[nodeID]; !exists || otherTime > currentTime {
			vc.clocks[nodeID] = otherTime
		}
	}
}

// Compare determines the causal relationship between two vector clocks.
func (vc *VectorClock) Compare(other *VectorClock) Comparison {
	vc.mu.RLock()
	defer vc.mu.RUnlock()
	other.mu.RLock()
	defer other.mu.RUnlock()

	// Collect all node IDs
	allNodes := make(map[string]struct{})
	for k := range vc.clocks {
		allNodes[k] = struct{}{}
	}
	for k := range other.clocks {
		allNodes[k] = struct{}{}
	}

	hasLess := false
	hasGreater := false

	for nodeID := range allNodes {
		t1 := vc.clocks[nodeID]
		t2 := other.clocks[nodeID]

		if t1 < t2 {
			hasLess = true
		}
		if t1 > t2 {
			hasGreater = true
		}
	}

	switch {
	case !hasLess && !hasGreater:
		return Equal
	case hasLess && !hasGreater:
		return Before
	case !hasLess && hasGreater:
		return After
	default:
		return Concurrent
	}
}

// HappenedBefore returns true if vc happened before other.
func (vc *VectorClock) HappenedBefore(other *VectorClock) bool {
	return vc.Compare(other) == Before
}

// HappenedAfter returns true if vc happened after other.
func (vc *VectorClock) HappenedAfter(other *VectorClock) bool {
	return vc.Compare(other) == After
}

// IsConcurrent returns true if vc and other are concurrent.
func (vc *VectorClock) IsConcurrent(other *VectorClock) bool {
	return vc.Compare(other) == Concurrent
}

// Sum returns the sum of all clock values.
func (vc *VectorClock) Sum() uint64 {
	vc.mu.RLock()
	defer vc.mu.RUnlock()

	var sum uint64
	for _, v := range vc.clocks {
		sum += v
	}
	return sum
}

// Nodes returns all node IDs in the vector clock.
func (vc *VectorClock) Nodes() []string {
	vc.mu.RLock()
	defer vc.mu.RUnlock()

	nodes := make([]string, 0, len(vc.clocks))
	for k := range vc.clocks {
		nodes = append(nodes, k)
	}
	return nodes
}

// ToMap returns the clock as a map.
func (vc *VectorClock) ToMap() map[string]uint64 {
	vc.mu.RLock()
	defer vc.mu.RUnlock()

	result := make(map[string]uint64, len(vc.clocks))
	for k, v := range vc.clocks {
		result[k] = v
	}
	return result
}

// MarshalJSON implements json.Marshaler.
func (vc *VectorClock) MarshalJSON() ([]byte, error) {
	vc.mu.RLock()
	defer vc.mu.RUnlock()
	return json.Marshal(vc.clocks)
}

// UnmarshalJSON implements json.Unmarshaler.
func (vc *VectorClock) UnmarshalJSON(data []byte) error {
	vc.mu.Lock()
	defer vc.mu.Unlock()

	if vc.clocks == nil {
		vc.clocks = make(map[string]uint64)
	}
	return json.Unmarshal(data, &vc.clocks)
}