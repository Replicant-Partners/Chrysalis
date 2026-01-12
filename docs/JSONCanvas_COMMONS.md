## JSONCanvas Commons Contract

- JSONCanvas is a shared rendering surface inside Chrysalis Terminal.
- The terminal persists JSON canvas documents; each document is a list of items with coordinates and metadata.
- JSONCanvas is responsible only for visualizing a provided document; it does not produce or mutate data.
- Switching canvases swaps the active document without affecting renderer responsibilities.
- Agent and human participants treat the canvas as a neutral commons for shared context.
  - Governance (who may write/move items) is enforced by higher-level Chrysalis processes.
- There is no visitor pattern; items are plain JSON objects.
  - Example item envelope:
    ```json
    {
      "id": "node-123",
      "type": "note",
      "position": { "x": 120, "y": 64 },
      "size": { "width": 180, "height": 120 },
      "payload": { "text": "Next action" }
    }
    ```
- JSONCanvas accepts:
  - `document`: the array of item envelopes
  - optional read-only metadata (viewport, selection hint)
- JSONCanvas forbids:
  - owning interaction logic (drag/move/write)
  - embedding widget registries or resource adapters
  - interpreting “snapshots.” The renderer always expects a current document from the terminal state.
- Save/open flow:
  1. Terminal persists a document to storage (CRDT/YJS or other backend)
  2. User selects another document
  3. Terminal provides the new document to JSONCanvas for rendering
- Documentation mandate:
  - Any future change to JSONCanvas must restate: “JSONCanvas renders JSON documents; it never owns business logic.”
