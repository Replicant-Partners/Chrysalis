# Agent Jobs and Proactive Conversations System

**Purpose**: Modularize system agent behavior with JSON-based configuration for job assignments, conversation triggers, openers, and agent-specific idioms.

**Status**: Specification and Implementation Plan

---

## Overview

This system extends the existing agent configuration (`config/agents/*.json`) with:

1. **Job Assignments** - Scheduled or event-driven tasks agents perform
2. **Conversation Triggers** - Conditions that cause agents to initiate conversations
3. **Conversational Openers** - What agents say when they initiate
4. **Agent Idioms** - Character-specific phrases and expressions that create social signals

---

## Schema Design

### Base Schema Location

Agent job and conversation configuration extends the existing agent JSON files in `config/agents/*.json` with a new `behavior` section:

```json
{
  "schema": { "name": "chrysalis.agent_spec", "version": "1.0" },
  "id": "agent_id",
  "profile": { ... },
  "runtime": { ... },
  "behavior": {
    "jobs": [ ... ],
    "conversation_triggers": [ ... ],
    "openers": [ ... ],
    "idioms": [ ... ]
  }
}
```

---

## 1. Job Assignments Schema

Jobs define scheduled or event-driven tasks agents perform, similar to Milton's managed services.

### Schema

```json
{
  "behavior": {
    "jobs": [
      {
        "job_id": "string",                    // Unique identifier
        "name": "string",                      // Human-readable name
        "description": "string",               // What this job does
        "schedule": {
          "type": "cron|interval|event",       // How job is triggered
          "value": "string",                   // Cron expression, interval, or event name
          "timezone": "string"                 // Optional timezone (default: UTC)
        },
        "enabled": true,                       // Can be disabled
        "priority": "high|medium|low",         // Execution priority
        "timeout_seconds": 300,                // Max execution time
        "retry": {
          "max_attempts": 3,
          "backoff_seconds": 60
        },
        "data_sources": ["string"],            // What data this job needs
        "outputs": ["string"],                 // What this job produces
        "rights_required": ["string"]          // Permissions needed
      }
    ]
  }
}
```

### Schedule Types

**Cron**: Scheduled at specific times
```json
{
  "type": "cron",
  "value": "0 4 * * *",  // 4 AM daily
  "timezone": "America/New_York"
}
```

**Interval**: Runs at regular intervals
```json
{
  "type": "interval",
  "value": "1h",  // Every hour
  "start_delay_seconds": 0  // Optional delay before first run
}
```

**Event**: Triggered by system events
```json
{
  "type": "event",
  "value": "photo_ingested",  // Event name
  "filters": {                 // Optional event filters
    "user_id": "specific_user",
    "photo_count": { "gte": 10 }
  }
}
```

### Example: Milton's Nightly Health Check

```json
{
  "job_id": "nightly_health_check",
  "name": "Nightly System Health Check",
  "description": "Run system diagnostics and generate performance report",
  "schedule": {
    "type": "cron",
    "value": "0 4 * * *",
    "timezone": "UTC"
  },
  "enabled": true,
  "priority": "high",
  "timeout_seconds": 600,
  "data_sources": ["audit_log", "benchmarks", "system_profile"],
  "outputs": ["milton_report"],
  "rights_required": ["read_telemetry", "read_benchmarks"]
}
```

### Example: 85er's Action Translation Job

```json
{
  "job_id": "translate_sent_actions",
  "name": "Translate Sent Actions to System Commands",
  "description": "Monitor sent actions and translate them into executable system commands",
  "schedule": {
    "type": "event",
    "value": "action_sent",
    "filters": {
      "requires_translation": true
    }
  },
  "enabled": true,
  "priority": "high",
  "timeout_seconds": 30,
  "data_sources": ["action_queue", "user_preferences"],
  "outputs": ["translated_commands"],
  "rights_required": ["read_actions", "write_commands"]
}
```

---

## 2. Conversation Triggers Schema

Defines conditions that cause agents to proactively initiate conversations with users.

### Schema

```json
{
  "behavior": {
    "conversation_triggers": [
      {
        "trigger_id": "string",               // Unique identifier
        "name": "string",                     // Human-readable name
        "condition": {
          "type": "time_since_last|event|metric|user_state",
          "parameters": { ... }               // Condition-specific parameters
        },
        "cooldown_seconds": 3600,            // Minimum time between triggers
        "enabled": true,
        "priority": "high|medium|low",        // Which trigger to use if multiple match
        "context_required": ["string"]         // What context agent needs
      }
    ]
  }
}
```

### Condition Types

**Time Since Last Conversation**
```json
{
  "type": "time_since_last",
  "parameters": {
    "agent_id": "any|specific_agent_id",     // Which agent's last message counts
    "threshold_seconds": 3600,                // Trigger if no conversation for this long
    "user_active": true                       // Only if user is currently active
  }
}
```

**Event-Based**
```json
{
  "type": "event",
  "parameters": {
    "event_name": "photo_uploaded",
    "count_threshold": 5,                     // Trigger after N events
    "time_window_seconds": 300                // Within this time window
  }
}
```

**Metric-Based**
```json
{
  "type": "metric",
  "parameters": {
    "metric_name": "error_rate",
    "operator": "gte",                        // gte, lte, eq, ne
    "threshold": 0.1,
    "duration_seconds": 60                    // Condition must be true for this long
  }
}
```

**User State**
```json
{
  "type": "user_state",
  "parameters": {
    "state": "idle|confused|stuck",          // User state to detect
    "duration_seconds": 300                   // How long in this state
  }
}
```

### Example: Ro51e's Check-In Trigger

```json
{
  "trigger_id": "ro51e_check_in",
  "name": "Ro51e Check-In After Quiet Period",
  "condition": {
    "type": "time_since_last",
    "parameters": {
      "agent_id": "any",
      "threshold_seconds": 3600,              // 1 hour
      "user_active": true
    }
  },
  "cooldown_seconds": 7200,                  // Don't trigger more than once per 2 hours
  "enabled": true,
  "priority": "medium",
  "context_required": ["user_activity", "recent_photos"]
}
```

---

## 3. Conversational Openers Schema

Defines what agents say when they initiate conversations.

### Schema

```json
{
  "behavior": {
    "openers": [
      {
        "opener_id": "string",                // Unique identifier
        "trigger_id": "string",               // Which trigger this opener responds to
        "variations": [                       // Multiple variations for naturalness
          {
            "text": "string",                 // The opener text
            "weight": 1.0,                    // Relative frequency (default: 1.0)
            "conditions": {                   // Optional conditions for this variation
              "time_of_day": "morning|afternoon|evening",
              "user_mood": "happy|neutral|tired"
            }
          }
        ],
        "follow_up_prompt": "string",         // Optional: what to ask after opener
        "tone": "warm|curious|concerned|excited"
      }
    ]
  }
}
```

### Example: Ro51e's Check-In Opener

```json
{
  "opener_id": "ro51e_quiet_check_in",
  "trigger_id": "ro51e_check_in",
  "variations": [
    {
      "text": "It's been so quiet around here—that worries me when it's quiet. Would you like a snack?",
      "weight": 1.0
    },
    {
      "text": "Oh my, it's been awfully quiet! Back in St. Olaf, we'd say that's when the best stories are hiding. Want to go for a ride on the magic canvas?",
      "weight": 0.8,
      "conditions": {
        "time_of_day": "afternoon"
      }
    },
    {
      "text": "Well, I've been sitting here thinking—when it's this quiet, something wonderful is usually about to happen! Shall we explore?",
      "weight": 0.7
    }
  ],
  "follow_up_prompt": "What would you like to explore today?",
  "tone": "warm"
}
```

---

## 4. Agent Idioms Schema

Character-specific phrases and expressions that create social signals and personality.

### Schema

```json
{
  "behavior": {
    "idioms": [
      {
        "idiom_id": "string",                 // Unique identifier
        "category": "catchphrase|metaphor|reference|complaint|exclamation",
        "phrases": [                          // Variations of this idiom
          {
            "text": "string",
            "weight": 1.0,                    // Relative frequency
            "context": ["string"]              // When to use this phrase
          }
        ],
        "frequency": "high|medium|low",       // How often this idiom appears
        "seasonal": {                         // Optional: time-based usage
          "months": [1, 2, 3],                // Which months (1-12)
          "events": ["nfl_season", "nba_playoffs"]
        },
        "triggers": ["string"]                // What prompts this idiom
      }
    ]
  }
}
```

### Example: Ro51e's Magic Canvas Idiom

```json
{
  "idiom_id": "magic_canvas",
  "category": "metaphor",
  "phrases": [
    {
      "text": "Want to go for a ride on the magic canvas?",
      "weight": 1.0,
      "context": ["exploration", "discovery", "check_in"]
    },
    {
      "text": "The magic canvas is calling—shall we answer?",
      "weight": 0.7,
      "context": ["photo_browsing"]
    },
    {
      "text": "Hop on the magic canvas with me!",
      "weight": 0.8,
      "context": ["encouragement"]
    }
  ],
  "frequency": "high",
  "triggers": ["photo_exploration", "user_idle", "check_in"]
}
```

### Example: Ro51e's Quiet Worry Idiom

```json
{
  "idiom_id": "quiet_worry",
  "category": "complaint",
  "phrases": [
    {
      "text": "It worries me when it's quiet.",
      "weight": 1.0,
      "context": ["check_in", "idle_detection"]
    },
    {
      "text": "It's just all been so quiet—that's when I start to wonder what's happening!",
      "weight": 0.8,
      "context": ["extended_idle"]
    }
  ],
  "frequency": "medium",
  "triggers": ["time_since_last_conversation"]
}
```

### Example: DGV's Sports Metaphors

```json
{
  "idiom_id": "sports_photography_metaphors",
  "category": "metaphor",
  "phrases": [
    {
      "text": "Like a quarterback reading the defense, great photographers see the play before it happens.",
      "weight": 1.0,
      "context": ["photography_advice", "nfl_season"]
    },
    {
      "text": "That composition has the precision of a three-pointer—everything aligned just right.",
      "weight": 0.9,
      "context": ["photo_review", "nba_season"]
    }
  ],
  "frequency": "high",
  "seasonal": {
    "events": ["nfl_season", "nba_season", "mlb_season", "nhl_season", "college_football", "march_madness"]
  },
  "triggers": ["photography_lesson", "photo_analysis", "general_conversation"]
}
```

---

## Complete Example: Ro51e Configuration

```json
{
  "schema": { "name": "chrysalis.agent_spec", "version": "1.0" },
  "id": "rosie",
  "profile": {
    "display_name": "Ro51e_Frizz1",
    "persona": "..."
  },
  "behavior": {
    "jobs": [],
    "conversation_triggers": [
      {
        "trigger_id": "ro51e_check_in",
        "name": "Check-In After Quiet Period",
        "condition": {
          "type": "time_since_last",
          "parameters": {
            "agent_id": "any",
            "threshold_seconds": 3600,
            "user_active": true
          }
        },
        "cooldown_seconds": 7200,
        "enabled": true,
        "priority": "medium"
      }
    ],
    "openers": [
      {
        "opener_id": "ro51e_quiet_check_in",
        "trigger_id": "ro51e_check_in",
        "variations": [
          {
            "text": "It's been so quiet around here—that worries me when it's quiet. Would you like a snack?",
            "weight": 1.0
          },
          {
            "text": "Oh my, it's been awfully quiet! Want to go for a ride on the magic canvas?",
            "weight": 0.8
          }
        ],
        "tone": "warm"
      }
    ],
    "idioms": [
      {
        "idiom_id": "magic_canvas",
        "category": "metaphor",
        "phrases": [
          {
            "text": "Want to go for a ride on the magic canvas?",
            "weight": 1.0,
            "context": ["exploration", "check_in"]
          }
        ],
        "frequency": "high",
        "triggers": ["photo_exploration", "check_in"]
      },
      {
        "idiom_id": "quiet_worry",
        "category": "complaint",
        "phrases": [
          {
            "text": "It worries me when it's quiet.",
            "weight": 1.0,
            "context": ["check_in"]
          }
        ],
        "frequency": "medium",
        "triggers": ["time_since_last_conversation"]
      }
    ]
  }
}
```

---

## Implementation Plan

### Phase 1: Schema and Loader (Week 1)
1. Create schema validation
2. Extend agent registry to load behavior configs
3. Create job scheduler system
4. Create conversation trigger evaluator

### Phase 2: Runtime System (Week 2)
1. Implement job execution engine
2. Implement conversation trigger monitoring
3. Implement opener selection system
4. Integrate idioms into agent responses

### Phase 3: Integration (Week 3)
1. Add to existing agent configs
2. Create management API endpoints
3. Add monitoring and logging
4. Documentation and examples

---

## Benefits

1. **Modularity**: Agent behavior defined in JSON, not code
2. **Extensibility**: Easy to add new jobs, triggers, idioms
3. **Maintainability**: Clear separation of concerns
4. **Personality**: Idioms create consistent character voices
5. **Flexibility**: Agents can have different behaviors per deployment

---

## Next Steps

1. Review and refine schema
2. Create example configurations for all agents
3. Implement loader and runtime system
4. Add to code review critical issues list
