//! CRDT (Conflict-free Replicated Data Types) for Experience Sync
//!
//! This module provides CRDT implementations for distributed experience
//! synchronization across agent instances. It complements the memory system
//! CRDTs with experience-specific types.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

// =============================================================================
// Experience Event CRDT
// =============================================================================

/// An experience event that can be synchronized across instances
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExperienceEvent {
    pub id: String,
    pub instance_id: String,
    pub event_type: ExperienceEventType,
    pub timestamp: f64,
    pub payload: serde_json::Value,
    pub vector_clock: VectorClock,
}

/// Types of experience events
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ExperienceEventType {
    MemoryCreated,
    MemoryUpdated,
    PatternDiscovered,
    SkillLearned,
    EvaluationCompleted,
    CollaborationEvent,
    StateTransition,
    MetricUpdated,
}

// =============================================================================
// Vector Clock
// =============================================================================

/// Vector clock for causal ordering of events
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct VectorClock {
    clock: HashMap<String, u64>,
}

impl VectorClock {
    pub fn new() -> Self {
        Self::default()
    }

    /// Increment clock for an instance
    pub fn tick(&mut self, instance_id: &str) -> u64 {
        let entry = self.clock.entry(instance_id.to_string()).or_insert(0);
        *entry += 1;
        *entry
    }

    /// Get clock value for instance
    pub fn get(&self, instance_id: &str) -> u64 {
        *self.clock.get(instance_id).unwrap_or(&0)
    }

    /// Set clock value for instance
    pub fn set(&mut self, instance_id: String, value: u64) {
        self.clock.insert(instance_id, value);
    }

    /// Check if this clock happened-before other
    pub fn happened_before(&self, other: &VectorClock) -> bool {
        let mut dominated = false;

        for (id, &val) in &self.clock {
            let other_val = other.get(id);
            if val > other_val {
                return false;
            }
            if val < other_val {
                dominated = true;
            }
        }

        // Check if other has any entries we don't
        for (id, &val) in &other.clock {
            if !self.clock.contains_key(id) && val > 0 {
                dominated = true;
            }
        }

        dominated
    }

    /// Check if clocks are concurrent
    pub fn concurrent(&self, other: &VectorClock) -> bool {
        !self.happened_before(other) && !other.happened_before(self)
    }

    /// Merge clocks (element-wise max)
    pub fn merge(&mut self, other: &VectorClock) {
        for (id, &val) in &other.clock {
            let entry = self.clock.entry(id.clone()).or_insert(0);
            *entry = (*entry).max(val);
        }
    }

    /// Create merged copy
    pub fn merged(&self, other: &VectorClock) -> VectorClock {
        let mut result = self.clone();
        result.merge(other);
        result
    }
}

// =============================================================================
// Experience Log (Append-only CRDT)
// =============================================================================

/// Append-only log of experience events
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct ExperienceLog {
    events: Vec<ExperienceEvent>,
    seen_ids: HashSet<String>,
    clock: VectorClock,
}

impl ExperienceLog {
    pub fn new() -> Self {
        Self::default()
    }

    /// Append an event to the log
    pub fn append(&mut self, event: ExperienceEvent) -> bool {
        if self.seen_ids.contains(&event.id) {
            return false; // Duplicate
        }

        self.seen_ids.insert(event.id.clone());
        self.clock.merge(&event.vector_clock);
        self.events.push(event);
        true
    }

    /// Get events since a vector clock position
    pub fn events_since(&self, since: &VectorClock) -> Vec<&ExperienceEvent> {
        self.events
            .iter()
            .filter(|e| since.happened_before(&e.vector_clock))
            .collect()
    }

    /// Get all events
    pub fn all_events(&self) -> &[ExperienceEvent] {
        &self.events
    }

    /// Get current clock
    pub fn clock(&self) -> &VectorClock {
        &self.clock
    }

    /// Merge with another log
    pub fn merge(&mut self, other: &ExperienceLog) {
        for event in &other.events {
            if !self.seen_ids.contains(&event.id) {
                self.seen_ids.insert(event.id.clone());
                self.events.push(event.clone());
            }
        }
        self.clock.merge(&other.clock);

        // Sort by vector clock for deterministic ordering
        self.events.sort_by(|a, b| {
            if a.vector_clock.happened_before(&b.vector_clock) {
                std::cmp::Ordering::Less
            } else if b.vector_clock.happened_before(&a.vector_clock) {
                std::cmp::Ordering::Greater
            } else {
                // Concurrent - use ID as tiebreaker
                a.id.cmp(&b.id)
            }
        });
    }

    /// Get event count
    pub fn len(&self) -> usize {
        self.events.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }
}

// =============================================================================
// State Map (LWW-Map CRDT)
// =============================================================================

/// Entry in the LWW Map
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LWWEntry<T> {
    pub value: T,
    pub timestamp: f64,
    pub writer: String,
}

impl<T> LWWEntry<T> {
    pub fn new(value: T, timestamp: f64, writer: String) -> Self {
        LWWEntry {
            value,
            timestamp,
            writer,
        }
    }
}

/// Last-Writer-Wins Map for state synchronization
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct LWWMap<T> {
    entries: HashMap<String, LWWEntry<T>>,
}

impl<T: Clone> LWWMap<T> {
    pub fn new() -> Self {
        LWWMap {
            entries: HashMap::new(),
        }
    }

    /// Set a value with timestamp
    pub fn set(&mut self, key: String, value: T, timestamp: f64, writer: String) {
        if let Some(existing) = self.entries.get(&key) {
            if existing.timestamp > timestamp {
                return; // Existing value is newer
            }
            if existing.timestamp == timestamp && existing.writer >= writer {
                return; // Tie-break: existing wins
            }
        }
        self.entries
            .insert(key, LWWEntry::new(value, timestamp, writer));
    }

    /// Get a value
    pub fn get(&self, key: &str) -> Option<&T> {
        self.entries.get(key).map(|e| &e.value)
    }

    /// Get entry with metadata
    pub fn get_entry(&self, key: &str) -> Option<&LWWEntry<T>> {
        self.entries.get(key)
    }

    /// Remove a key (using tombstone timestamp)
    pub fn remove(&mut self, key: &str, _timestamp: f64) {
        // For simplicity, we just remove. In a full implementation,
        // you'd use a tombstone with the timestamp.
        self.entries.remove(key);
    }

    /// Get all keys
    pub fn keys(&self) -> Vec<&String> {
        self.entries.keys().collect()
    }

    /// Merge with another map
    pub fn merge(&mut self, other: &LWWMap<T>) {
        for (key, other_entry) in &other.entries {
            if let Some(self_entry) = self.entries.get(key) {
                if other_entry.timestamp > self_entry.timestamp
                    || (other_entry.timestamp == self_entry.timestamp
                        && other_entry.writer > self_entry.writer)
                {
                    self.entries.insert(key.clone(), other_entry.clone());
                }
            } else {
                self.entries.insert(key.clone(), other_entry.clone());
            }
        }
    }
}

// =============================================================================
// Delta State for Efficient Sync
// =============================================================================

/// Delta state for incremental synchronization
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DeltaState {
    pub from_clock: VectorClock,
    pub to_clock: VectorClock,
    pub events: Vec<ExperienceEvent>,
    pub state_updates: HashMap<String, serde_json::Value>,
}

impl DeltaState {
    /// Create an empty delta
    pub fn empty() -> Self {
        DeltaState {
            from_clock: VectorClock::new(),
            to_clock: VectorClock::new(),
            events: Vec::new(),
            state_updates: HashMap::new(),
        }
    }

    /// Check if delta is empty
    pub fn is_empty(&self) -> bool {
        self.events.is_empty() && self.state_updates.is_empty()
    }
}

// =============================================================================
// Experience Sync State
// =============================================================================

/// Complete synchronization state for an instance
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct SyncState {
    pub instance_id: String,
    pub log: ExperienceLog,
    pub metrics: LWWMap<f64>,
    pub metadata: LWWMap<serde_json::Value>,
    pub last_sync: f64,
}

impl SyncState {
    pub fn new(instance_id: String) -> Self {
        SyncState {
            instance_id,
            log: ExperienceLog::new(),
            metrics: LWWMap::new(),
            metadata: LWWMap::new(),
            last_sync: 0.0,
        }
    }

    /// Record an experience event
    pub fn record_event(
        &mut self,
        event_type: ExperienceEventType,
        payload: serde_json::Value,
    ) -> ExperienceEvent {
        let mut clock = self.log.clock().clone();
        clock.tick(&self.instance_id);

        let event = ExperienceEvent {
            id: uuid::Uuid::new_v4().to_string(),
            instance_id: self.instance_id.clone(),
            event_type,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs_f64(),
            payload,
            vector_clock: clock,
        };

        self.log.append(event.clone());
        event
    }

    /// Update a metric
    pub fn update_metric(&mut self, name: &str, value: f64) {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs_f64();
        self.metrics
            .set(name.to_string(), value, timestamp, self.instance_id.clone());
    }

    /// Compute delta since a clock position
    pub fn delta_since(&self, since: &VectorClock) -> DeltaState {
        DeltaState {
            from_clock: since.clone(),
            to_clock: self.log.clock().clone(),
            events: self
                .log
                .events_since(since)
                .into_iter()
                .cloned()
                .collect(),
            state_updates: HashMap::new(), // Would include changed state
        }
    }

    /// Apply a delta from another instance
    pub fn apply_delta(&mut self, delta: DeltaState) {
        for event in delta.events {
            self.log.append(event);
        }
        // Apply state updates if needed
    }

    /// Merge with another sync state
    pub fn merge(&mut self, other: &SyncState) {
        self.log.merge(&other.log);
        self.metrics.merge(&other.metrics);
        self.metadata.merge(&other.metadata);
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vector_clock_happened_before() {
        let mut vc1 = VectorClock::new();
        vc1.set("a".to_string(), 1);
        vc1.set("b".to_string(), 2);

        let mut vc2 = VectorClock::new();
        vc2.set("a".to_string(), 2);
        vc2.set("b".to_string(), 3);

        assert!(vc1.happened_before(&vc2));
        assert!(!vc2.happened_before(&vc1));
    }

    #[test]
    fn test_vector_clock_concurrent() {
        let mut vc1 = VectorClock::new();
        vc1.set("a".to_string(), 2);
        vc1.set("b".to_string(), 1);

        let mut vc2 = VectorClock::new();
        vc2.set("a".to_string(), 1);
        vc2.set("b".to_string(), 2);

        assert!(vc1.concurrent(&vc2));
    }

    #[test]
    fn test_experience_log_dedup() {
        let mut log = ExperienceLog::new();

        let event = ExperienceEvent {
            id: "event-1".to_string(),
            instance_id: "instance-a".to_string(),
            event_type: ExperienceEventType::MemoryCreated,
            timestamp: 1.0,
            payload: serde_json::json!({}),
            vector_clock: VectorClock::new(),
        };

        assert!(log.append(event.clone()));
        assert!(!log.append(event)); // Duplicate should be rejected
        assert_eq!(log.len(), 1);
    }

    #[test]
    fn test_lww_map_merge() {
        let mut map1: LWWMap<String> = LWWMap::new();
        map1.set("key".to_string(), "old".to_string(), 1.0, "w1".to_string());

        let mut map2: LWWMap<String> = LWWMap::new();
        map2.set("key".to_string(), "new".to_string(), 2.0, "w2".to_string());

        map1.merge(&map2);
        assert_eq!(map1.get("key"), Some(&"new".to_string()));
    }

    #[test]
    fn test_sync_state_record_event() {
        let mut state = SyncState::new("test-instance".to_string());

        let event = state.record_event(
            ExperienceEventType::PatternDiscovered,
            serde_json::json!({"pattern": "test"}),
        );

        assert_eq!(event.instance_id, "test-instance");
        assert_eq!(state.log.len(), 1);
    }
}
