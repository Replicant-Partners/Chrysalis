//! Metrics collection and exposure for the system agents service
//!
//! This module provides functionality for collecting and exposing
//! metrics about the system agents service using Prometheus.

// Allow dead_code for metrics that may not be used in all code paths
#![allow(dead_code)]

use prometheus::{
    register_histogram_vec, register_int_counter_vec, HistogramVec, IntCounterVec, Registry, Encoder, TextEncoder,
};
use thiserror::Error;

/// Errors that can occur during metrics operations
#[derive(Error, Debug)]
pub enum MetricsError {
    #[error("Failed to create metric: {0}")]
    CreationError(String),
    #[error("Failed to encode metrics: {0}")]
    #[allow(dead_code)]
    EncodingError(String),
}
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
    /// 
    /// # Errors
    /// Returns an error if Prometheus metrics cannot be registered
    pub fn try_new() -> Result<Self, MetricsError> {
        let registry = Registry::new();
        
        let request_duration = register_histogram_vec!(
            "system_agents_request_duration_seconds",
            "Request duration in seconds",
            &["method", "endpoint", "status"]
        )
        .map_err(|e| MetricsError::CreationError(e.to_string()))?;
        
        let requests_total = register_int_counter_vec!(
            "system_agents_requests_total",
            "Total number of requests",
            &["method", "endpoint", "status"]
        )
        .map_err(|e| MetricsError::CreationError(e.to_string()))?;
        
        Ok(Self {
            registry,
            request_duration,
            requests_total,
        })
    }
    
    /// Create a new metrics collector (panics on failure)
    /// 
    /// # Panics
    /// Panics if Prometheus metrics cannot be registered.
    /// Use `try_new()` for fallible construction.
    pub fn new() -> Self {
        Self::try_new().expect("Failed to create metrics collector")
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
    /// 
    /// # Errors
    /// Returns an error if metrics cannot be encoded
    pub fn try_gather_text(&self) -> Result<String, MetricsError> {
        let mut buffer = Vec::new();
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        encoder
            .encode(&metric_families, &mut buffer)
            .map_err(|e| MetricsError::EncodingError(e.to_string()))?;
        String::from_utf8(buffer)
            .map_err(|e| MetricsError::EncodingError(e.to_string()))
    }
    
    /// Get metrics as a Prometheus text format string (panics on failure)
    /// 
    /// # Panics
    /// Panics if metrics cannot be encoded. Use `try_gather_text()` for fallible encoding.
    pub fn gather_text(&self) -> String {
        self.try_gather_text().expect("Failed to gather metrics")
    }
}

impl Default for Metrics {
    fn default() -> Self {
        Self::new()
    }
}