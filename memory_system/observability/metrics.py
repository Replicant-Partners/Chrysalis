"""
Prometheus Metrics for Memory System

Provides observability metrics for memory operations, cloud sync, and circuit breaker states.
"""

from prometheus_client import Counter, Histogram, Gauge, Info
import time

# Memory operation metrics
memory_ops_total = Counter(
    'memory_operations_total',
    'Total number of memory operations',
    ['agent_id', 'operation', 'status']
)

memory_op_duration = Histogram(
    'memory_operation_duration_seconds',
    'Memory operation duration in seconds',
    ['agent_id', 'operation'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
)

# Cloud sync metrics
cloud_sync_lag = Gauge(
    'memory_cloud_sync_lag_seconds',
    'Time lag between local write and cloud sync',
    ['agent_id']
)

cloud_sync_queue_size = Gauge(
    'memory_cloud_sync_queue_size',
    'Number of documents waiting for cloud sync',
    ['agent_id']
)

cloud_sync_total = Counter(
    'memory_cloud_sync_total',
    'Total cloud sync operations',
    ['agent_id', 'status']
)

cloud_sync_batch_size = Histogram(
    'memory_cloud_sync_batch_size',
    'Number of documents in cloud sync batch',
    ['agent_id'],
    buckets=[1, 5, 10, 25, 50, 100, 250, 500]
)

# Circuit breaker metrics
circuit_breaker_state = Gauge(
    'circuit_breaker_state',
    'Circuit breaker state (0=closed, 1=half-open, 2=open)',
    ['name']
)

circuit_breaker_failures = Counter(
    'circuit_breaker_failures_total',
   'Total circuit breaker failures',
    ['name']
)

circuit_breaker_successes = Counter(
    'circuit_breaker_successes_total',
    'Total circuit breaker successes',
    ['name']
)

# CRDT merge metrics
crdt_merge_total = Counter(
    'crdt_merge_operations_total',
    'Total CRDT merge operations',
    ['operation_type']
)

crdt_conflicts_total = Counter(
    'crdt_conflicts_total',
    'Total CRDT conflicts detected',
    ['conflict_type']
)

# Memory storage metrics
memory_count = Gauge(
    'memory_documents_total',
    'Total number of memory documents',
    ['agent_id', 'memory_type']
)

memory_size_bytes = Gauge(
    'memory_storage_size_bytes',
    'Total storage size in bytes',
    ['agent_id']
)

# System info
system_info = Info(
    'memory_system',
    'Memory system information'
)


def record_memory_operation(
    agent_id: str,
    operation: str,
    duration: float,
    status: str = 'success'
):
    """
    Record memory operation metrics
    
    Args:
        agent_id: Agent ID
        operation: Operation type (store, retrieve, update, delete)
        duration: Operation duration in seconds
        status: Operation status (success, error)
    """
    memory_ops_total.labels(
        agent_id=agent_id,
        operation=operation,
        status=status
    ).inc()
    
    memory_op_duration.labels(
        agent_id=agent_id,
        operation=operation
    ).observe(duration)


def record_cloud_sync(
    agent_id: str,
    batch_size: int,
    duration: float,
    status: str = 'success'
):
    """
    Record cloud sync metrics
    
    Args:
        agent_id: Agent ID
        batch_size: Number of documents synced
        duration: Sync duration in seconds
        status: Sync status (success, error)
    """
    cloud_sync_total.labels(
        agent_id=agent_id,
        status=status
    ).inc()
    
    cloud_sync_batch_size.labels(
        agent_id=agent_id
    ).observe(batch_size)


def update_circuit_breaker_state(name: str, state: str):
    """
    Update circuit breaker state metric
    
    Args:
        name: Circuit breaker name
        state: State (closed, half_open, open)
    """
    state_value = {
        'closed': 0,
        'half_open': 1,
        'open': 2
    }.get(state, -1)
    
    circuit_breaker_state.labels(name=name).set(state_value)


def record_circuit_breaker_result(name: str, success: bool):
    """
    Record circuit breaker result
    
    Args:
        name: Circuit breaker name
        success: Whether operation succeeded
    """
    if success:
        circuit_breaker_successes.labels(name=name).inc()
    else:
        circuit_breaker_failures.labels(name=name).inc()


# Initialize system info
system_info.info({
    'version': '1.0.0',
    'rust_core': 'enabled',
    'cloud_provider': 'zep'
})
