# Canvas Conflict Resolution System

## Overview
This system resolves CRDT conflicts through an immutable merge contract executed by the Universal Adapter.
The contract encodes both the merge behavior and the semantic merge prompt set.
Users are not asked to resolve conflicts; they only initiate collaboration and approve the contract.

## 1) Architecture contracts

### Adapter-to-canvas interface
Canvas emits conflict events; the adapter returns resolved entities.

**Events (canvas -> adapter):**
- `conflict.detected`: `{ canvasId, entityType, entityId, baseState, localState, remoteState, roster, role }`
- `merge.requested`: `{ canvasId, contractHash, contractSignature, dnd, queuedConflicts }`
- `dnd.toggled`: `{ canvasId, enabled, at }`

**Responses (adapter -> canvas):**
- `merge.resolved`: `{ canvasId, entityId, mergedState, auditId }`
- `merge.failed`: `{ canvasId, entityId, reason, auditId }`
- `merge.deferred`: `{ canvasId, reason }`

### Task invocation protocol
The merge contract is an immutable task JSON that travels with the canvas.
Every collaborator verifies the contract hash and signature before execution.

**Contract fields (minimal):**
```json
{
  "contract_id": "canvas-merge-contract",
  "contract_hash": "sha256:...",
  "contract_signature": "ed25519:...",
  "ontology_version": "canvas-ontology@1",
  "semantic_prompt_set": "embedded",
  "admin_policy": "timestamp_precedence",
  "dnd_behavior": "pause_all",
  "roles": ["admin", "collaborator"]
}
```

### CRDT-to-adapter triggers
Trigger the adapter when:
- A conflict is detected on merge of divergent saved states.
- A DND pause is lifted and queued conflicts exist.
- A collaborator receives remote changes while DND is off.

## 2) DND mechanism
- **DND ON**: pause CRDT streaming (both inbound and outbound).
- Queue conflict tasks; dedupe by `{entityType, entityId}` with the latest local saved state.
- **DND OFF**: batch-process queued conflicts through the adapter.
- **Per-user only**: DND is a local canvas setting; it is never shared.
- **No save while DND**: a canvas cannot be saved with DND enabled.
- **Open always updates**: opening a shared canvas always pulls latest state.
- **Canvas pause**: if the group must pause, admins lock the canvas.

### Merge protocol (single canonical)
There is one conflict-resolution process in the initial release.
The task JSON lives with the adapter and is signed when a canvas is shared.

## 2B) Canvas types (system-level, non-domain)
Canvas types are interaction modes, not domain ontologies. They provide coarse
context for policy and widgets but do not define the meaning of the content.

Default set:
| Canvas type | Purpose | Default sensitivity |
| --- | --- | --- |
| settings | System configuration and credentials | High |
| scrapbook | Generic collection and grouping | Low |
| research | Sources, synthesis, citations | Medium |
| wiki | Structured knowledge pages | Medium |
| terminal-browser | Command sessions + embedded browsing | High |
| agent | Agent cards/hypercards for status, control, and interaction | High |

Sensitivity influences admin policy thresholds but does not change ontology
resolution, which remains schema.org anchored.

Creation rule:
- Any collaborator can create a canvas type (no admin gate).

Extensibility examples (not default types):
- curation
- media

Primary job statements:
- **settings**: manage system configuration, file locations, tool connections, and local/cloud/LLM wiring.
- **scrapbook**: gather artifacts without a fixed schema, link/group items, attach significance notes, then query and reorganize later.
- **research**: gather evidence within a known domain and sense-making frame; collection is shaped by the method.
- **wiki**: persistent shared knowledgebase for humans and agents; explicit, structured knowledge (Wikipedia-style model).
- **terminal-browser**: shared live work surface for coding and external browsing; a study-group table.
- **agent**: manage internal agent teams (store, revise, run) and leverage accumulated skills/knowledge over time.

Scrapbook vs research:
- **Scrapbook** discovers the domain and the organizing frame.
- **Research** applies a known frame to collect the right evidence.

Interaction fundamentals (all canvases):
- Open, close, save, drag-and-drop must be flawless.
- No hidden state: objects should not pile up or overlap.
- Snap-to-fit should keep layouts clean and predictable.
- If unclear, the user can ask Ada to explain the UI state.

## Core interaction baseline (acceptance criteria)
These are the primary acceptance criteria for every canvas. Canvas-specific
features are secondary until these are proven stable.

1. **Open/Close/Save**: deterministic, fast, and reliable.
2. **Drag-and-drop**: precise, low-latency, no jitter or loss.
3. **Non-overlap**: system prevents hidden stacking or ambiguous state.
4. **Snap-to-fit**: predictable layout adjustments, no UI drift.
5. **Explainability**: Ada can answer "what happened" for any UI change.

Telemetry note:
- Keep acceptance criteria qualitative for now, but emit telemetry for latency,
  errors, and interaction failures to support later quantification.

### Agent canvas properties
- **Representation**: agents appear as cards/hypercards with status, controls, and interaction entry points.
- **Lifecycle control**: clicking a card can start an agent; cards can expose run/stop/idle state.
- **Run-on-open**: default is off; autorun is an explicit per-card toggle.
- **Autorun control**: a top-right on/off slider on the hypercard.
- **Invisible operation**: the agent canvas can be set to invisible while agents continue running.
- **Invisible constraints**: heavy widgets (terminal-browser; media deferred) do not run while invisible.
- **Interaction surfaces**: agents can be engaged via chat panes and may act on other open canvases
  or on their own invisible canvases for background work.
- **Summary card**: shows name + brief description.
- **Agent tooling**: affordances to edit agent JSON/persona, view skills, and inspect memory stacks.
- **Memory UX**: verify memory connectivity, list connected stacks, and chat with memories.

## 3) Role-based authorization model
Roles are determined by the collaboration contract and token scope:
- **Admin**: rollback changes, lock objects, apply timestamp precedence.
- **Collaborator**: semantic merge via RDF decomposition.

Admin defaults to the originator, with optional admin grants in the invite.
Admin status is stored in the contract metadata.

## 4) Admin conflict resolution
Admin conflicts are resolved without user interaction:
- **Timestamp precedence**: most recent change wins when both edits target the same field.
- **Rollback**: admin may revert to base state if policy demands stability.
- **Lock**: admin may lock an object to prevent further edits until reopened.
- **Canvas lock**: admin may lock the entire canvas to pause group work.

All outcomes are logged and notified to affected collaborators.

## 5) Semantic merge framework (collaborator conflicts)
Semantic merges preserve both contributions by default and avoid "winner/loser" framing.
The adapter uses RDF as the canonical merge space.

### Ontology resolution
There is no fixed Chrysalis domain ontology. The merge contract resolves the
best domain ontology at runtime and anchors on schema.org types.

Deterministic resolution rule:
1. **Widget-only context**: analyze the conflicting widget content and select a
   schema.org type if confidence >= 0.90.
2. **Canvas context fallback**: if widget-only confidence < 0.90, analyze the
   full canvas context and select a schema.org type if confidence >= 0.90.
3. **Generic fallback**: if confidence remains < 0.90, use `schema:Thing`
   and decompose using generic field predicates only.

### Merge algorithm
1. **Resolve ontology**: select the schema.org type using the deterministic rule above.
2. **Decompose**: convert base/local/remote entities to RDF triples using the resolved ontology.
2. **Union + dedupe**: combine triple sets and remove exact duplicates.
3. **Conflict handling**:
   - Same subject+predicate with different objects -> preserve both using `chrysalis:hasVariant`.
   - Deletion vs modification -> archive deletion with `chrysalis:archivedFrom`.
4. **Reconstitute**: build the merged entity from the unified RDF set.
5. **Validate**: enforce widget schema constraints before returning.

### Collaborative intent rules
- Preserve both contributions whenever possible.
- Never discard content unless an explicit delete is present and policy allows it.
- If a merge cannot respect both inputs, escalate to admin policy.

## 6) Semantic merge prompt set
The prompt set is embedded in the merge contract and executed by the adapter.
All prompts must be deterministic in output shape (JSON + RDF).

**Prompt 0: Ontology resolution (schema.org anchored)**
```
Analyze the conflicting widget content only.
Select the most precise schema.org type and assign a confidence score in [0,1].
If confidence >= 0.90, return it as the selected ontology.
If confidence < 0.90, return "undetermined" and provide the top 3 candidates.

Return JSON:
{
  "scope": "widget",
  "selectedType": "schema:Event | schema:Person | ... | undetermined",
  "confidence": 0.0,
  "candidates": [{ "type": "schema:...", "confidence": 0.0 }],
  "evidence": ["short reasons from content"]
}
```

**Prompt 0B: Canvas context fallback**
```
Analyze the entire canvas context (all widgets) to infer the best schema.org type.
Select if confidence >= 0.90. Otherwise return "schema:Thing".

Return JSON:
{
  "scope": "canvas",
  "selectedType": "schema:... | schema:Thing",
  "confidence": 0.0,
  "candidates": [{ "type": "schema:...", "confidence": 0.0 }],
  "evidence": ["short reasons from canvas context"]
}
```

**Prompt A: Context extraction**
```
You are the merge executor. Extract context from base/local/remote states.
Return JSON with: { entityType, entityId, keyFields, conflicts[], ontologyVersion }.
Do not resolve conflicts in this step.
```

**Prompt B: RDF decomposition**
```
Decompose base/local/remote entities into RDF triples using the resolved ontology.
Output JSON: { baseRdf[], localRdf[], remoteRdf[] }.
Each triple must use canonical predicates from the ontology.
```

**Prompt C: Semantic overlap identification**
```
Compare RDF sets to identify semantic overlaps and conflicts.
Output JSON: { overlaps[], conflicts[], safeUnions[] }.
```

**Prompt D: Merged RDF synthesis**
```
Create a unified RDF set that preserves both contributions.
Use chrysalis:hasVariant when objects conflict.
Output JSON: { mergedRdf[] }.
```

**Prompt E: Entity reconstitution**
```
Reconstitute the merged entity from mergedRdf.
Output JSON: { mergedEntity }.
Ensure schema validity for the entityType.
```

## 7) Adapter integration
The adapter routes conflicts based on role:
- **Admin** -> admin strategy (timestamp/rollback/lock).
- **Collaborator** -> semantic merge prompt set.

Merge results are returned to the CRDT process for state reconciliation.

LLM selection for semantic merge prompts:
- **Provider**: OpenAI
- **Model**: `gpt-5`

## 8) Audit and notification
Every resolution emits:
- `auditId`, `contractHash`, `entityId`, `method`, `role`, `timestamp`.
Notifications are sent to collaborators whose entities were merged or locked.

## Open items
- Set policy thresholds for escalation.
- Define notification delivery mechanisms.