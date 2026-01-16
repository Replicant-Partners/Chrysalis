"""
Durable Job/Event Stores

Pattern 11: DURABLE WORKFLOW
Jobs as SSOT for workflow execution state; Events as SSOT for progress/history.

@see Borrowed_Ideas/SYSTEM_AGENT_MIDDLEWARE_DESIGN.md
@see Borrowed_Ideas/JOBS_EVENTS_SCHEMA_PROPOSAL.md

Features:
- JSON-per-job storage with SHA-384 fingerprinting
- JSONL append-only events per job
- Worker claim pattern for distributed execution
- Structured event format for observability
"""
from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Literal
import uuid


# =============================================================================
# Types
# =============================================================================

JobStatus = Literal["queued", "running", "succeeded", "failed", "canceled"]
JobPriority = Literal["high", "medium", "low"]
JobEventType = Literal["JOB_STATE", "JOB_PROGRESS", "JOB_OUTPUT", "JOB_ERROR", "USER_ACTION_REQUIRED"]


@dataclass
class JobSchedule:
    """Job scheduling configuration."""
    type: Literal["cron", "interval", "event"]
    value: str
    timezone: str = "UTC"
    start_delay_seconds: Optional[int] = None
    filters: Optional[Dict[str, Any]] = None


@dataclass
class JobRecord:
    """
    Durable job record with cryptographic fingerprint.

    The fingerprint is computed from job_type + subject_id + idempotency_key
    to enable deduplication and audit trails.
    """
    job_id: str
    job_type: str
    status: JobStatus = "queued"

    # Subject tracking
    subject_type: Optional[str] = None
    subject_id: Optional[str] = None

    # Execution tracking
    attempts: int = 0
    max_attempts: int = 3
    idempotency_key: Optional[str] = None

    # Timestamps
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    # Schedule (optional, for scheduled jobs)
    schedule: Optional[Dict[str, Any]] = None

    # Priority
    priority: JobPriority = "medium"
    timeout_seconds: int = 300

    # Data flow
    data_sources: List[str] = field(default_factory=list)
    outputs: List[str] = field(default_factory=list)
    rights_required: List[str] = field(default_factory=list)

    # Error tracking
    last_error_code: Optional[str] = None
    last_error_message: Optional[str] = None
    last_error_details: Optional[Dict[str, Any]] = None

    # Vector clock for distributed ordering
    vector_clock: Dict[str, int] = field(default_factory=dict)

    # Cryptographic identity
    agent_fingerprint: Optional[str] = None
    signature: Optional[str] = None

    # Additional metadata
    metadata: Dict[str, Any] = field(default_factory=dict)

    def compute_fingerprint(self) -> str:
        """Compute SHA-384 fingerprint for this job."""
        data = f"{self.job_type}:{self.subject_id or ''}:{self.idempotency_key or ''}"
        return hashlib.sha384(data.encode()).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return asdict(self)


@dataclass
class JobEvent:
    """
    Job event for progress/history tracking.

    Uses structured event format for observability.
    """
    event_id: str
    job_id: str
    timestamp: str
    type: JobEventType
    level: str = "info"
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

    # Progress-specific fields
    percent: Optional[int] = None
    phase: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return asdict(self)

    def to_observability_event(self) -> Dict[str, Any]:
        """Convert to structured observability event format."""
        return {
            "kind": f"job.{self.type.lower().replace('job_', '')}",
            "timestamp": self.timestamp,
            "details": {
                "event_id": self.event_id,
                "job_id": self.job_id,
                "level": self.level,
                "message": self.message,
                "data": self.data,
                "percent": self.percent,
                "phase": self.phase,
            }
        }


# =============================================================================
# Event Listener Type
# =============================================================================

EventListener = Callable[[JobEvent], None]


# =============================================================================
# JobStore Implementation
# =============================================================================

class JobStore:
    """
    JSON-per-job storage with index map.

    Pattern 11: DURABLE WORKFLOW
    Jobs as System of Record for workflow execution state.
    """

    def __init__(self, base_dir: str = "./data/jobs"):
        self.base_dir = base_dir
        self.jobs_dir = os.path.join(base_dir, "records")
        os.makedirs(self.jobs_dir, exist_ok=True)
        self._event_listeners: List[EventListener] = []

    def _job_path(self, job_id: str) -> str:
        return os.path.join(self.jobs_dir, f"{job_id}.json")

    def add_event_listener(self, listener: EventListener) -> None:
        """Add a listener for job events (for observability integration)."""
        self._event_listeners.append(listener)

    def remove_event_listener(self, listener: EventListener) -> None:
        """Remove an event listener."""
        if listener in self._event_listeners:
            self._event_listeners.remove(listener)

    def _emit_event(self, event: JobEvent) -> None:
        """Emit event to all listeners."""
        for listener in self._event_listeners:
            try:
                listener(event)
            except Exception:
                pass  # Don't let listener errors affect job operations

    def create(
        self,
        job_type: str,
        subject_id: Optional[str] = None,
        subject_type: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        priority: JobPriority = "medium",
        timeout_seconds: int = 300,
        schedule: Optional[JobSchedule] = None,
        data_sources: Optional[List[str]] = None,
        outputs: Optional[List[str]] = None,
        rights_required: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any
    ) -> JobRecord:
        """Create a new job with optional fingerprinting."""
        record = JobRecord(
            job_id=str(uuid.uuid4()),
            job_type=job_type,
            subject_id=subject_id,
            subject_type=subject_type,
            idempotency_key=idempotency_key,
            priority=priority,
            timeout_seconds=timeout_seconds,
            schedule=asdict(schedule) if schedule else None,
            data_sources=data_sources or [],
            outputs=outputs or [],
            rights_required=rights_required or [],
            metadata=metadata or {},
            **kwargs
        )

        # Compute fingerprint
        record.agent_fingerprint = record.compute_fingerprint()

        self.save(record)

        # Emit creation event
        self._emit_event(JobEvent(
            event_id=str(uuid.uuid4()),
            job_id=record.job_id,
            timestamp=datetime.utcnow().isoformat(),
            type="JOB_STATE",
            level="info",
            message=f"Job created: {job_type}",
            data={"status": "queued", "job_type": job_type},
        ))

        return record

    def save(self, record: JobRecord) -> None:
        """Save job record to storage."""
        record.updated_at = datetime.utcnow().isoformat()
        with open(self._job_path(record.job_id), "w", encoding="utf-8") as handle:
            json.dump(record.to_dict(), handle, indent=2)

    def get(self, job_id: str) -> Optional[JobRecord]:
        """Get a job by ID."""
        path = self._job_path(job_id)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        return JobRecord(**data)

    def list(
        self,
        status: Optional[JobStatus] = None,
        job_type: Optional[str] = None,
        priority: Optional[JobPriority] = None,
        limit: int = 100
    ) -> List[JobRecord]:
        """List jobs with optional filtering."""
        jobs: List[JobRecord] = []

        for filename in os.listdir(self.jobs_dir):
            if not filename.endswith(".json"):
                continue

            path = os.path.join(self.jobs_dir, filename)
            with open(path, "r", encoding="utf-8") as handle:
                data = json.load(handle)

            record = JobRecord(**data)

            # Apply filters
            if status and record.status != status:
                continue
            if job_type and record.job_type != job_type:
                continue
            if priority and record.priority != priority:
                continue

            jobs.append(record)

            if len(jobs) >= limit:
                break

        # Sort by created_at descending
        jobs.sort(key=lambda j: j.created_at, reverse=True)
        return jobs

    def claim_next(
        self,
        worker_id: str,
        job_types: List[str],
        instance_id: Optional[str] = None
    ) -> Optional[JobRecord]:
        """
        Claim the next available job for a worker.

        Worker pattern for distributed job execution.
        """
        # Find eligible jobs
        candidates = self.list(status="queued")

        # Filter by job type
        candidates = [j for j in candidates if j.job_type in job_types]

        # Filter by attempts
        candidates = [j for j in candidates if j.attempts < j.max_attempts]

        # Sort by priority (high > medium > low) then by created_at
        priority_order = {"high": 3, "medium": 2, "low": 1}
        candidates.sort(
            key=lambda j: (priority_order.get(j.priority, 0), j.created_at),
            reverse=True
        )

        if not candidates:
            return None

        # Claim the first candidate
        record = candidates[0]
        record.status = "running"
        record.attempts += 1

        # Update vector clock
        if instance_id:
            record.vector_clock[instance_id] = record.vector_clock.get(instance_id, 0) + 1

        self.save(record)

        # Emit state event
        self._emit_event(JobEvent(
            event_id=str(uuid.uuid4()),
            job_id=record.job_id,
            timestamp=datetime.utcnow().isoformat(),
            type="JOB_STATE",
            level="info",
            message=f"Job claimed by {worker_id}",
            data={"status": "running", "worker_id": worker_id, "attempt": record.attempts},
        ))

        return record

    def update_status(
        self,
        job_id: str,
        status: JobStatus,
        error: Optional[Dict[str, Any]] = None
    ) -> Optional[JobRecord]:
        """Update job status with optional error details."""
        record = self.get(job_id)
        if not record:
            return None

        old_status = record.status
        record.status = status

        if error:
            record.last_error_code = error.get("code")
            record.last_error_message = error.get("message")
            record.last_error_details = error.get("details")

        self.save(record)

        # Emit state event
        event_type: JobEventType = "JOB_STATE"
        level = "info"
        if status == "failed":
            event_type = "JOB_ERROR"
            level = "error"

        self._emit_event(JobEvent(
            event_id=str(uuid.uuid4()),
            job_id=record.job_id,
            timestamp=datetime.utcnow().isoformat(),
            type=event_type,
            level=level,
            message=f"Job status changed: {old_status} -> {status}",
            data={"old_status": old_status, "new_status": status, "error": error},
        ))

        return record

    def verify_fingerprint(self, job_id: str) -> bool:
        """Verify that a job's fingerprint matches its content."""
        record = self.get(job_id)
        if not record:
            return False

        expected = record.compute_fingerprint()
        return record.agent_fingerprint == expected


# =============================================================================
# EventStore Implementation
# =============================================================================

class EventStore:
    """
    Append-only JSONL events per job.

    Pattern 11: DURABLE WORKFLOW
    Events as System of Record for progress/history.
    """

    def __init__(self, base_dir: str = "./data/jobs"):
        self.base_dir = base_dir
        self.events_dir = os.path.join(base_dir, "events")
        os.makedirs(self.events_dir, exist_ok=True)

    def _events_path(self, job_id: str) -> str:
        return os.path.join(self.events_dir, f"{job_id}.jsonl")

    def append(
        self,
        job_id: str,
        event_type: JobEventType,
        message: Optional[str] = None,
        percent: Optional[int] = None,
        phase: Optional[str] = None,
        level: str = "info",
        **data: Any
    ) -> JobEvent:
        """Append an event to the job's event log."""
        event = JobEvent(
            event_id=str(uuid.uuid4()),
            job_id=job_id,
            timestamp=datetime.utcnow().isoformat(),
            type=event_type,
            level=level,
            message=message,
            data=data if data else None,
            percent=percent,
            phase=phase,
        )

        with open(self._events_path(job_id), "a", encoding="utf-8") as handle:
            handle.write(json.dumps(event.to_dict()) + "\n")

        return event

    def tail(
        self,
        job_id: str,
        since_event_id: Optional[str] = None,
        limit: int = 100
    ) -> List[JobEvent]:
        """Get events after a specific event ID."""
        events = self.replay(job_id)

        if since_event_id:
            # Find the index of since_event_id
            found_idx = -1
            for i, event in enumerate(events):
                if event.event_id == since_event_id:
                    found_idx = i
                    break

            if found_idx >= 0:
                events = events[found_idx + 1:]

        return events[:limit]

    def replay(self, job_id: str) -> List[JobEvent]:
        """Replay all events for a job."""
        path = self._events_path(job_id)
        if not os.path.exists(path):
            return []

        events: List[JobEvent] = []
        with open(path, "r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                payload = json.loads(line)
                events.append(JobEvent(**payload))

        return events

    def get_progress(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get the latest progress for a job."""
        events = self.replay(job_id)

        # Find the most recent progress event
        progress_events = [e for e in events if e.type == "JOB_PROGRESS"]
        if not progress_events:
            return None

        latest = progress_events[-1]
        return {
            "percent": latest.percent,
            "phase": latest.phase,
            "message": latest.message,
            "timestamp": latest.timestamp,
        }


# =============================================================================
# Factory Functions
# =============================================================================

def create_job_store(base_dir: str = "./data/jobs") -> JobStore:
    """Create a JobStore instance."""
    return JobStore(base_dir)


def create_event_store(base_dir: str = "./data/jobs") -> EventStore:
    """Create an EventStore instance."""
    return EventStore(base_dir)
