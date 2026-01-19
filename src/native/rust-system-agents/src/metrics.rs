//! Metrics collection and exposure for the system agents service
//!
//! This module provides functionality for collecting and exposing
//! metrics about the system agents service using Prometheus.

use prometheus::{
    register_histogram_vec, register_int_counter_vec, HistogramVec, IntCounterVec, Registry, Encoder, TextEncoder,
};
use std::time::Instant;

/// Metrics collection for the system agents service
#[derive(Debug, Clone)]
pub struct Metrics {
    registry: Registry,
    request_duration: HistogramVec,
    requests_total: IntCounterVec,
}

impl Metrics {
    /// Create a new metrics collector
    pub fn new() -> Self {
        let registry = Registry::new();
        
        let request_duration = register_histogram_vec!(
            "system_agents_request_duration_seconds",
            "Request duration in seconds",
            &["method", "endpoint", "status"]
        )
        .expect("Failed to create request duration histogram");
        
        let requests_total = register_int_counter_vec!(
            "system_agents_requests_total",
            "Total number of requests",
            &["method", "endpoint", "status"]
        )
        .expect("Failed to create requests counter");
        
        Self {
            registry,
            request_duration,
            requests_total,
        }
    }
    
    /// Record a request with timing information
    pub fn record_request(
        &self,
        method: &str,
        endpoint: &str,
        status: &str,
        start_time: Instant,
    ) {
        let duration = start_time.elapsed().as_secs_f64();
        self.request_duration
            .with_label_values(&[method, endpoint, status])
            .observe(duration);
        self.requests_total
            .with_label_values(&[method, endpoint, status])
            .inc();
    }
    
    /// Get the Prometheus registry
    pub fn registry(&self) -> &Registry {
        &self.registry
    }
    
    /// Get metrics as a Prometheus text format string
    pub fn gather_text(&self) -> String {
        let mut buffer = Vec::new();
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        encoder.encode(&metric_families, &mut buffer).expect("Failed to encode metrics");
        String::from_utf8(buffer).expect("Failed to convert metrics to string")
    }
}

impl Default for Metrics {
    fn default() -> Self {
        Self::new()
    }
}