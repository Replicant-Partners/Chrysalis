# Universal Adapter Application Notes

Date: 2026-01-17  
Author: Team Chrysalis

## What Changed
- **Task invocation by name:** Added a `TaskLibrary` (`DEFAULT_TASK_LIBRARY`) and wired `UniversalAdapter.execute/run_task/execute_task` to resolve task names directly, so processes can call `adapter.execute("simple_qa")` without managing paths.
- **Goal-gated flows:** Introduced a `GOAL_CHECK` node type and enforced that all terminal paths route through it; flows now fail validation if they lack a goal gate or have unreachable nodes/loop exits.
- **Flow robustness checks:** Flow validation now flags unreachable nodes, missing loop exit edges, and end nodes not guarded by goal checks—addressing completeness and inevitability of termination.
- **Loop accounting:** Loop nodes now increment/reset counters during execution, enabling iteration limits to behave predictably.
- **Task artifacts:** Added spec-aligned task JSONs (`protocol_translation_task.json`, `agent_morph_task.json`, `flow_guardrail_task.json`) with explicit goal checks and iteration constraints.

## How to Apply the General Logic Device
1) **Select a task by name** (e.g., `protocol_translation`) and call `execute_task("protocol_translation")`.  
2) **Pass context via interpolation variables** (`agent_payload`, `source_protocol`, `target_protocol`, etc.) rather than hard-coded logic.  
3) **Let the flow drive control**—Mermaid diagrams encode branching and looping; no bespoke Python logic is needed beyond updating the task JSON.  
4) **Validate before execution**—flows are checked for reachability, loop exits, and goal gates to avoid partial or non-terminating runs.  
5) **Rely on goal verification**—termination is gated on `GoalVerifier` outcomes (`goal_met`/`goal_failed`), ensuring completion criteria are enforced.

## Flow Diagram Requirements
- Every path to an end node must pass through a `GOAL`/`GOAL_CHECK` gate.  
- Loops need an explicit `exit` edge; otherwise validation fails.  
- All nodes must be reachable from `START`; unreachable nodes are rejected.  
- Goal conditions in `task.json` must map to flow categories (`goal_met`, `goal_failed`) to keep the gate meaningful.

## Integration Notes
- **Drop-in replacement:** Where bespoke orchestration code existed, replace it with a task name + context map; the adapter now handles schema parsing, flow execution, and goal validation.  
- **Extensibility:** Add or override tasks via `TaskLibrary.from_pairs(...)` to register local task files without code changes.  
- **Resilience:** Execution timeouts, iteration caps, and structural validation combine to reduce stuck flows while keeping the adapter general-purpose.
