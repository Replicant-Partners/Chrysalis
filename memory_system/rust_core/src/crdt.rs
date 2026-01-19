//! CRDT (Conflict-free Replicated Data Types) implementations
//!
//! Provides three fundamental CRDT types for agent memory:
//! - GSet: Grow-only set (memories that never delete)
//! - ORSet: Observed-Remove set (metadata with removal)
//! - LWWRegister: Last-Writer-Wins register (scalar attributes)

use pyo3::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// G-Set: Grow-only Set CRDT
///
/// Elements can only be added, never removed.
/// Merge operation is set union.
///
/// Properties:
/// - Commutative: merge(A, B) = merge(B, A)
/// - Associative: merge(merge(A, B), C) = merge(A, merge(B, C))
/// - Idempotent: merge(A, A) = A
#[pyclass]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GSet {
    elements: HashSet<String>,
}

#[pymethods]
impl GSet {
    #[new]
    pub fn new() -> Self {
        GSet {
            elements: HashSet::new(),
        }
    }

    /// Add an element to the set
    pub fn add(&mut self, element: String) {
        self.elements.insert(element);
    }

    /// Check if element exists in set
    pub fn contains(&self, element: &str) -> bool {
        self.elements.contains(element)
    }

    /// Get all elements as a list
    pub fn elements(&self) -> Vec<String> {
        self.elements.iter().cloned().collect()
    }

    /// Get the number of elements
    pub fn len(&self) -> usize {
        self.elements.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.elements.is_empty()
    }

    /// Merge with another GSet (CRDT merge = union)
    pub fn merge(&self, other: &GSet) -> GSet {
        let mut result = self.clone();
        for element in &other.elements {
            result.elements.insert(element.clone());
        }
        result
    }

    /// Merge in place
    pub fn merge_into(&mut self, other: &GSet) {
        for element in &other.elements {
            self.elements.insert(element.clone());
        }
    }

    fn __repr__(&self) -> String {
        format!("GSet(len={})", self.elements.len())
    }
}

impl Default for GSet {
    fn default() -> Self {
        Self::new()
    }
}

/// OR-Set: Observed-Remove Set CRDT
///
/// Elements have unique tags; remove only removes observed tags.
/// Enables add/remove while remaining conflict-free.
///
/// - Add(x) creates a new unique tag for x
/// - Remove(x) removes only tags observed at remove time
/// - Concurrent add+remove: add wins (new tag wasn't observed)
#[pyclass]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ORSet {
    /// Map from element to set of tags (each add creates a unique tag)
    elements: HashMap<String, HashSet<String>>,
    /// Counter for generating unique tags
    tag_counter: u64,
    /// Instance ID for tag uniqueness
    instance_id: String,
}

#[pymethods]
impl ORSet {
    #[new]
    #[pyo3(signature = (instance_id=None))]
    pub fn new(instance_id: Option<String>) -> Self {
        ORSet {
            elements: HashMap::new(),
            tag_counter: 0,
            instance_id: instance_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
        }
    }

    /// Add element with auto-generated unique tag
    pub fn add(&mut self, element: String) -> String {
        self.tag_counter += 1;
        let tag = format!("{}:{}", self.instance_id, self.tag_counter);

        self.elements
            .entry(element)
            .or_insert_with(HashSet::new)
            .insert(tag.clone());

        tag
    }

    /// Add element with specific tag
    pub fn add_with_tag(&mut self, element: String, tag: String) {
        self.elements
            .entry(element)
            .or_insert_with(HashSet::new)
            .insert(tag);
    }

    /// Remove element (only observed tags)
    pub fn remove(&mut self, element: &str, observed_tags: Vec<String>) {
        if let Some(tags) = self.elements.get_mut(element) {
            for tag in observed_tags {
                tags.remove(&tag);
            }
            if tags.is_empty() {
                self.elements.remove(element);
            }
        }
    }

    /// Remove element completely (remove all current tags)
    pub fn remove_all(&mut self, element: &str) -> Vec<String> {
        if let Some(tags) = self.elements.remove(element) {
            tags.into_iter().collect()
        } else {
            Vec::new()
        }
    }

    /// Check if element exists
    pub fn contains(&self, element: &str) -> bool {
        self.elements.contains_key(element)
    }

    /// Get all elements
    pub fn elements(&self) -> Vec<String> {
        self.elements.keys().cloned().collect()
    }

    /// Get tags for an element
    pub fn get_tags(&self, element: &str) -> Vec<String> {
        self.elements
            .get(element)
            .map(|tags| tags.iter().cloned().collect())
            .unwrap_or_default()
    }

    /// Get number of elements
    pub fn len(&self) -> usize {
        self.elements.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.elements.is_empty()
    }

    /// Merge with another ORSet (CRDT merge = union of tags per element)
    pub fn merge(&self, other: &ORSet) -> ORSet {
        let mut result = self.clone();

        for (element, tags) in &other.elements {
            let entry = result.elements.entry(element.clone()).or_insert_with(HashSet::new);
            for tag in tags {
                entry.insert(tag.clone());
            }
        }

        // Update tag counter to max
        result.tag_counter = result.tag_counter.max(other.tag_counter);

        result
    }

    /// Merge in place
    pub fn merge_into(&mut self, other: &ORSet) {
        for (element, tags) in &other.elements {
            let entry = self.elements.entry(element.clone()).or_insert_with(HashSet::new);
            for tag in tags {
                entry.insert(tag.clone());
            }
        }
        self.tag_counter = self.tag_counter.max(other.tag_counter);
    }

    fn __repr__(&self) -> String {
        format!("ORSet(len={})", self.elements.len())
    }
}

impl Default for ORSet {
    fn default() -> Self {
        Self::new(None)
    }
}

/// LWW-Register: Last-Writer-Wins Register CRDT
///
/// Single value with timestamp; highest timestamp wins.
/// Tie-breaking by writer ID ensures determinism.
#[pyclass]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LWWRegister {
    value: Option<String>,
    timestamp: f64,
    writer: String,
}

#[pymethods]
impl LWWRegister {
    #[new]
    #[pyo3(signature = (value=None, timestamp=None, writer=None))]
    pub fn new(value: Option<String>, timestamp: Option<f64>, writer: Option<String>) -> Self {
        LWWRegister {
            value,
            timestamp: timestamp.unwrap_or(0.0),
            writer: writer.unwrap_or_default(),
        }
    }

    /// Set value with timestamp
    pub fn set(&mut self, value: String, timestamp: f64, writer: String) {
        self.value = Some(value);
        self.timestamp = timestamp;
        self.writer = writer;
    }

    /// Get current value
    pub fn get(&self) -> Option<String> {
        self.value.clone()
    }

    /// Get timestamp
    pub fn get_timestamp(&self) -> f64 {
        self.timestamp
    }

    /// Get writer
    pub fn get_writer(&self) -> String {
        self.writer.clone()
    }

    /// Check if has value
    pub fn has_value(&self) -> bool {
        self.value.is_some()
    }

    /// Merge with another LWWRegister (highest timestamp wins)
    pub fn merge(&self, other: &LWWRegister) -> LWWRegister {
        if self.timestamp > other.timestamp {
            self.clone()
        } else if other.timestamp > self.timestamp {
            other.clone()
        } else {
            // Tie-break by writer ID (lexicographic)
            if self.writer >= other.writer {
                self.clone()
            } else {
                other.clone()
            }
        }
    }

    /// Merge in place (updates self if other wins)
    pub fn merge_into(&mut self, other: &LWWRegister) -> bool {
        let other_wins = if self.timestamp > other.timestamp {
            false
        } else if other.timestamp > self.timestamp {
            true
        } else {
            other.writer > self.writer
        };

        if other_wins {
            self.value = other.value.clone();
            self.timestamp = other.timestamp;
            self.writer = other.writer.clone();
        }

        other_wins
    }

    fn __repr__(&self) -> String {
        format!(
            "LWWRegister(value={:?}, ts={}, writer={})",
            self.value, self.timestamp, self.writer
        )
    }
}

impl Default for LWWRegister {
    fn default() -> Self {
        Self::new(None, None, None)
    }
}

/// LWW-Register for numeric values (with max semantics option)
#[pyclass]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LWWNumericRegister {
    value: f64,
    timestamp: f64,
    writer: String,
    use_max: bool, // If true, always take max value instead of LWW
}

#[pymethods]
impl LWWNumericRegister {
    #[new]
    #[pyo3(signature = (value=None, timestamp=None, writer=None, use_max=None))]
    pub fn new(
        value: Option<f64>,
        timestamp: Option<f64>,
        writer: Option<String>,
        use_max: Option<bool>,
    ) -> Self {
        LWWNumericRegister {
            value: value.unwrap_or(0.0),
            timestamp: timestamp.unwrap_or(0.0),
            writer: writer.unwrap_or_default(),
            use_max: use_max.unwrap_or(false),
        }
    }

    /// Set value
    pub fn set(&mut self, value: f64, timestamp: f64, writer: String) {
        self.value = value;
        self.timestamp = timestamp;
        self.writer = writer;
    }

    /// Get current value
    pub fn get(&self) -> f64 {
        self.value
    }

    /// Merge with another register
    pub fn merge(&self, other: &LWWNumericRegister) -> LWWNumericRegister {
        if self.use_max {
            // Max semantics: always take the higher value
            if self.value >= other.value {
                self.clone()
            } else {
                LWWNumericRegister {
                    value: other.value,
                    timestamp: other.timestamp.max(self.timestamp),
                    writer: other.writer.clone(),
                    use_max: true,
                }
            }
        } else {
            // LWW semantics
            if self.timestamp > other.timestamp {
                self.clone()
            } else if other.timestamp > self.timestamp {
                other.clone()
            } else if self.writer >= other.writer {
                self.clone()
            } else {
                other.clone()
            }
        }
    }

    fn __repr__(&self) -> String {
        format!("LWWNumericRegister(value={}, use_max={})", self.value, self.use_max)
    }
}

/// Counter CRDT (always takes max)
#[pyclass]
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct GCounter {
    /// Map from instance_id to count
    counts: HashMap<String, u64>,
}

#[pymethods]
impl GCounter {
    #[new]
    pub fn new() -> Self {
        GCounter {
            counts: HashMap::new(),
        }
    }

    /// Increment counter for an instance
    pub fn increment(&mut self, instance_id: String) {
        *self.counts.entry(instance_id).or_insert(0) += 1;
    }

    /// Increment by specific amount
    pub fn increment_by(&mut self, instance_id: String, amount: u64) {
        *self.counts.entry(instance_id).or_insert(0) += amount;
    }

    /// Get total count across all instances
    pub fn value(&self) -> u64 {
        self.counts.values().sum()
    }

    /// Get count for specific instance
    pub fn get_instance_count(&self, instance_id: &str) -> u64 {
        *self.counts.get(instance_id).unwrap_or(&0)
    }

    /// Merge with another counter (element-wise max)
    pub fn merge(&self, other: &GCounter) -> GCounter {
        let mut result = self.clone();

        for (instance_id, count) in &other.counts {
            let entry = result.counts.entry(instance_id.clone()).or_insert(0);
            *entry = (*entry).max(*count);
        }

        result
    }

    /// Merge in place
    pub fn merge_into(&mut self, other: &GCounter) {
        for (instance_id, count) in &other.counts {
            let entry = self.counts.entry(instance_id.clone()).or_insert(0);
            *entry = (*entry).max(*count);
        }
    }

    fn __repr__(&self) -> String {
        format!("GCounter(value={})", self.value())
    }
}

/// Vector Clock for causality tracking
#[pyclass]
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct VectorClock {
    clock: HashMap<String, u64>,
}

#[pymethods]
impl VectorClock {
    #[new]
    pub fn new() -> Self {
        VectorClock {
            clock: HashMap::new(),
        }
    }

    /// Increment clock for an instance
    pub fn tick(&mut self, instance_id: String) -> u64 {
        let entry = self.clock.entry(instance_id).or_insert(0);
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

    /// Check if clocks are concurrent (neither happened-before the other)
    pub fn concurrent(&self, other: &VectorClock) -> bool {
        !self.happened_before(other) && !other.happened_before(self)
    }

    /// Merge clocks (element-wise max)
    pub fn merge(&self, other: &VectorClock) -> VectorClock {
        let mut result = self.clone();

        for (id, &val) in &other.clock {
            let entry = result.clock.entry(id.clone()).or_insert(0);
            *entry = (*entry).max(val);
        }

        result
    }

    /// Merge in place
    pub fn merge_into(&mut self, other: &VectorClock) {
        for (id, &val) in &other.clock {
            let entry = self.clock.entry(id.clone()).or_insert(0);
            *entry = (*entry).max(val);
        }
    }

    /// Get as dictionary
    pub fn to_dict(&self) -> HashMap<String, u64> {
        self.clock.clone()
    }

    fn __repr__(&self) -> String {
        format!("VectorClock({:?})", self.clock)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gset_commutative() {
        let mut a = GSet::new();
        a.add("m1".to_string());
        a.add("m2".to_string());

        let mut b = GSet::new();
        b.add("m2".to_string());
        b.add("m3".to_string());

        let ab = a.merge(&b);
        let ba = b.merge(&a);

        assert_eq!(ab.len(), ba.len());
        assert_eq!(ab.elements().len(), 3);
    }

    #[test]
    fn test_gset_associative() {
        let mut a = GSet::new();
        a.add("m1".to_string());

        let mut b = GSet::new();
        b.add("m2".to_string());

        let mut c = GSet::new();
        c.add("m3".to_string());

        let ab_c = a.merge(&b).merge(&c);
        let a_bc = a.merge(&b.merge(&c));

        assert_eq!(ab_c.len(), a_bc.len());
    }

    #[test]
    fn test_gset_idempotent() {
        let mut a = GSet::new();
        a.add("m1".to_string());
        a.add("m2".to_string());

        let aa = a.merge(&a);
        assert_eq!(aa.len(), a.len());
    }

    #[test]
    fn test_lww_timestamp_wins() {
        let mut r1 = LWWRegister::new(None, None, None);
        r1.set("old".to_string(), 1.0, "w1".to_string());

        let mut r2 = LWWRegister::new(None, None, None);
        r2.set("new".to_string(), 2.0, "w2".to_string());

        let merged = r1.merge(&r2);
        assert_eq!(merged.get(), Some("new".to_string()));
    }

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
}
