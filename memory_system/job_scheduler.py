"""
Job Scheduler

Pattern 11: DURABLE WORKFLOW
Schedules jobs based on cron, interval, and event triggers.

@see Borrowed_Ideas/SYSTEM_AGENT_MIDDLEWARE_DESIGN.md
@see Borrowed_Ideas/JOBS_EVENTS_SCHEMA_PROPOSAL.md

Features:
- Cron expression parsing (via croniter)
- Interval-based scheduling
- Event-triggered job creation
- Priority queue for execution
"""
from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional, Set
from heapq import heappush, heappop
import logging

from .job_store import JobStore, EventStore, JobRecord, JobSchedule

logger = logging.getLogger(__name__)


# =============================================================================
# Types
# =============================================================================

@dataclass
class ScheduledJob:
    """A job scheduled for execution at a specific time."""
    next_run_ms: float
    job_definition: Dict[str, Any]
    agent_id: str
    priority_value: int = 2  # 1=high, 2=medium, 3=low

    def __lt__(self, other: "ScheduledJob") -> bool:
        """Priority queue ordering: earlier time, then higher priority."""
        if self.next_run_ms != other.next_run_ms:
            return self.next_run_ms < other.next_run_ms
        return self.priority_value < other.priority_value


@dataclass
class EventSubscription:
    """Subscription to an event for triggering jobs."""
    event_name: str
    job_definition: Dict[str, Any]
    agent_id: str
    filters: Optional[Dict[str, Any]] = None


# =============================================================================
# Cron Parsing (Simplified)
# =============================================================================

def parse_cron_field(field: str, min_val: int, max_val: int) -> Set[int]:
    """Parse a single cron field into a set of valid values."""
    values: Set[int] = set()

    for part in field.split(','):
        part = part.strip()

        if part == '*':
            values.update(range(min_val, max_val + 1))
        elif '/' in part:
            base, step = part.split('/')
            step_val = int(step)
            if base == '*':
                values.update(range(min_val, max_val + 1, step_val))
            else:
                start = int(base)
                values.update(range(start, max_val + 1, step_val))
        elif '-' in part:
            start, end = part.split('-')
            values.update(range(int(start), int(end) + 1))
        else:
            values.add(int(part))

    return values


def next_cron_time(cron_expr: str, after: datetime) -> datetime:
    """
    Calculate the next execution time for a cron expression.

    Format: minute hour day_of_month month day_of_week

    Simplified implementation - for production use croniter library.
    """
    parts = cron_expr.split()
    if len(parts) != 5:
        raise ValueError(f"Invalid cron expression: {cron_expr}")

    minutes = parse_cron_field(parts[0], 0, 59)
    hours = parse_cron_field(parts[1], 0, 23)
    days = parse_cron_field(parts[2], 1, 31)
    months = parse_cron_field(parts[3], 1, 12)
    weekdays = parse_cron_field(parts[4], 0, 6)  # 0=Sunday

    # Start searching from the next minute
    candidate = after.replace(second=0, microsecond=0) + timedelta(minutes=1)

    # Search for up to a year
    max_iterations = 365 * 24 * 60  # One year of minutes

    for _ in range(max_iterations):
        if (candidate.month in months and
            candidate.day in days and
            candidate.weekday() in weekdays and
            candidate.hour in hours and
            candidate.minute in minutes):
            return candidate
        candidate += timedelta(minutes=1)

    raise ValueError(f"Could not find next execution time for: {cron_expr}")


def parse_interval(interval_str: str) -> timedelta:
    """
    Parse interval string to timedelta.

    Supported formats: 1h, 30m, 5s, 1d
    """
    match = re.match(r'^(\d+)([smhd])$', interval_str.strip())
    if not match:
        raise ValueError(f"Invalid interval format: {interval_str}")

    value = int(match.group(1))
    unit = match.group(2)

    if unit == 's':
        return timedelta(seconds=value)
    elif unit == 'm':
        return timedelta(minutes=value)
    elif unit == 'h':
        return timedelta(hours=value)
    elif unit == 'd':
        return timedelta(days=value)
    else:
        raise ValueError(f"Unknown interval unit: {unit}")


# =============================================================================
# JobScheduler Implementation
# =============================================================================

class JobScheduler:
    """
    Schedules and executes jobs based on cron, interval, and event triggers.

    Pattern 11: DURABLE WORKFLOW
    """

    def __init__(
        self,
        job_store: JobStore,
        event_store: EventStore,
        timezone: str = "UTC"
    ):
        self.job_store = job_store
        self.event_store = event_store
        self.timezone = timezone

        # Priority queue of scheduled jobs
        self._queue: List[ScheduledJob] = []

        # Event subscriptions
        self._event_subscriptions: Dict[str, List[EventSubscription]] = {}

        # Job executors by job_type
        self._executors: Dict[str, Callable] = {}

        # Running state
        self._running = False
        self._task: Optional[asyncio.Task] = None

    def register_executor(self, job_type: str, executor: Callable) -> None:
        """Register an executor function for a job type."""
        self._executors[job_type] = executor

    def schedule_job(
        self,
        agent_id: str,
        job_definition: Dict[str, Any]
    ) -> None:
        """
        Schedule a job based on its schedule configuration.

        Schedule types:
        - cron: Execute at specific times
        - interval: Execute every N seconds/minutes/hours
        - event: Execute when an event occurs
        """
        schedule = job_definition.get("schedule", {})
        schedule_type = schedule.get("type")

        if not schedule_type:
            logger.warning(f"Job {job_definition.get('job_id')} has no schedule type")
            return

        priority_map = {"high": 1, "medium": 2, "low": 3}
        priority_value = priority_map.get(job_definition.get("priority", "medium"), 2)

        if schedule_type == "cron":
            self._schedule_cron_job(agent_id, job_definition, priority_value)
        elif schedule_type == "interval":
            self._schedule_interval_job(agent_id, job_definition, priority_value)
        elif schedule_type == "event":
            self._subscribe_event_job(agent_id, job_definition)
        else:
            logger.warning(f"Unknown schedule type: {schedule_type}")

    def _schedule_cron_job(
        self,
        agent_id: str,
        job_definition: Dict[str, Any],
        priority_value: int
    ) -> None:
        """Schedule a cron-based job."""
        schedule = job_definition.get("schedule", {})
        cron_expr = schedule.get("value", "")

        try:
            next_time = next_cron_time(cron_expr, datetime.utcnow())
            scheduled = ScheduledJob(
                next_run_ms=next_time.timestamp() * 1000,
                job_definition=job_definition,
                agent_id=agent_id,
                priority_value=priority_value,
            )
            heappush(self._queue, scheduled)
            logger.info(f"Scheduled cron job {job_definition.get('job_id')} for {next_time}")
        except Exception as e:
            logger.error(f"Failed to schedule cron job: {e}")

    def _schedule_interval_job(
        self,
        agent_id: str,
        job_definition: Dict[str, Any],
        priority_value: int
    ) -> None:
        """Schedule an interval-based job."""
        schedule = job_definition.get("schedule", {})
        interval_str = schedule.get("value", "1h")
        start_delay = schedule.get("start_delay_seconds", 0)

        try:
            interval = parse_interval(interval_str)
            next_time = datetime.utcnow() + timedelta(seconds=start_delay)

            scheduled = ScheduledJob(
                next_run_ms=next_time.timestamp() * 1000,
                job_definition=job_definition,
                agent_id=agent_id,
                priority_value=priority_value,
            )
            heappush(self._queue, scheduled)
            logger.info(f"Scheduled interval job {job_definition.get('job_id')} for {next_time}")
        except Exception as e:
            logger.error(f"Failed to schedule interval job: {e}")

    def _subscribe_event_job(
        self,
        agent_id: str,
        job_definition: Dict[str, Any]
    ) -> None:
        """Subscribe to an event for triggering a job."""
        schedule = job_definition.get("schedule", {})
        event_name = schedule.get("value", "")
        filters = schedule.get("filters")

        subscription = EventSubscription(
            event_name=event_name,
            job_definition=job_definition,
            agent_id=agent_id,
            filters=filters,
        )

        if event_name not in self._event_subscriptions:
            self._event_subscriptions[event_name] = []
        self._event_subscriptions[event_name].append(subscription)

        logger.info(f"Subscribed job {job_definition.get('job_id')} to event {event_name}")

    def trigger_event(self, event_name: str, event_data: Dict[str, Any] = None) -> List[str]:
        """
        Trigger an event, creating jobs for all matching subscriptions.

        Returns list of created job IDs.
        """
        created_jobs: List[str] = []
        subscriptions = self._event_subscriptions.get(event_name, [])

        for subscription in subscriptions:
            # Check filters
            if subscription.filters and event_data:
                matches = all(
                    event_data.get(k) == v
                    for k, v in subscription.filters.items()
                )
                if not matches:
                    continue

            # Create the job
            job_def = subscription.job_definition
            record = self.job_store.create(
                job_type=job_def.get("job_id", "event_triggered"),
                subject_type="event",
                subject_id=event_name,
                priority=job_def.get("priority", "medium"),
                timeout_seconds=job_def.get("timeout_seconds", 300),
                metadata={
                    "agent_id": subscription.agent_id,
                    "event_name": event_name,
                    "event_data": event_data,
                }
            )
            created_jobs.append(record.job_id)

            logger.info(f"Event {event_name} triggered job {record.job_id}")

        return created_jobs

    async def run(self) -> None:
        """Start the scheduler loop."""
        self._running = True
        logger.info("Job scheduler started")

        while self._running:
            try:
                await self._process_queue()
                await asyncio.sleep(1)  # Check every second
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                await asyncio.sleep(5)

        logger.info("Job scheduler stopped")

    async def _process_queue(self) -> None:
        """Process any jobs that are due."""
        now_ms = datetime.utcnow().timestamp() * 1000

        while self._queue and self._queue[0].next_run_ms <= now_ms:
            scheduled = heappop(self._queue)

            job_def = scheduled.job_definition
            job_id = job_def.get("job_id", "unknown")

            # Check if job is enabled
            if not job_def.get("enabled", True):
                logger.debug(f"Skipping disabled job {job_id}")
                continue

            # Create and execute job
            try:
                record = self.job_store.create(
                    job_type=job_id,
                    subject_type="scheduled",
                    priority=job_def.get("priority", "medium"),
                    timeout_seconds=job_def.get("timeout_seconds", 300),
                    metadata={
                        "agent_id": scheduled.agent_id,
                        "schedule_type": job_def.get("schedule", {}).get("type"),
                    }
                )

                # Execute if we have an executor
                executor = self._executors.get(job_id)
                if executor:
                    await self._execute_job(record, executor)

            except Exception as e:
                logger.error(f"Failed to create/execute job {job_id}: {e}")

            # Reschedule if recurring
            schedule = job_def.get("schedule", {})
            schedule_type = schedule.get("type")

            if schedule_type == "cron":
                self._schedule_cron_job(
                    scheduled.agent_id,
                    job_def,
                    scheduled.priority_value
                )
            elif schedule_type == "interval":
                # Schedule next interval
                interval = parse_interval(schedule.get("value", "1h"))
                next_time = datetime.utcnow() + interval
                next_scheduled = ScheduledJob(
                    next_run_ms=next_time.timestamp() * 1000,
                    job_definition=job_def,
                    agent_id=scheduled.agent_id,
                    priority_value=scheduled.priority_value,
                )
                heappush(self._queue, next_scheduled)

    async def _execute_job(
        self,
        record: JobRecord,
        executor: Callable
    ) -> None:
        """Execute a job with error handling."""
        try:
            # Update status to running
            self.job_store.update_status(record.job_id, "running")

            # Emit progress event
            self.event_store.append(
                record.job_id,
                "JOB_PROGRESS",
                message="Job started",
                percent=0,
                phase="starting",
            )

            # Execute
            if asyncio.iscoroutinefunction(executor):
                result = await executor(record)
            else:
                result = executor(record)

            # Update status to succeeded
            self.job_store.update_status(record.job_id, "succeeded")

            # Emit output event
            self.event_store.append(
                record.job_id,
                "JOB_OUTPUT",
                message="Job completed successfully",
                percent=100,
                phase="complete",
                result=result,
            )

        except Exception as e:
            logger.error(f"Job {record.job_id} failed: {e}")
            self.job_store.update_status(
                record.job_id,
                "failed",
                error={"code": "EXECUTION_ERROR", "message": str(e)}
            )

    def stop(self) -> None:
        """Stop the scheduler."""
        self._running = False
        if self._task:
            self._task.cancel()

    def get_pending_count(self) -> int:
        """Get the number of pending scheduled jobs."""
        return len(self._queue)

    def get_event_subscriptions(self, event_name: str) -> List[EventSubscription]:
        """Get all subscriptions for an event."""
        return self._event_subscriptions.get(event_name, [])


# =============================================================================
# Factory Functions
# =============================================================================

def create_job_scheduler(
    job_store: Optional[JobStore] = None,
    event_store: Optional[EventStore] = None,
    base_dir: str = "./data/jobs"
) -> JobScheduler:
    """Create a JobScheduler instance."""
    store = job_store or JobStore(base_dir)
    events = event_store or EventStore(base_dir)
    return JobScheduler(store, events)
