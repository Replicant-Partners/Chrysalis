(** Conflict-free Replicated Data Types (CRDTs)

    This module provides immutable CRDT implementations that guarantee
    eventual consistency through commutative, associative, and idempotent
    merge operations.
*)

module StringMap = Map.Make(String)
module StringSet = Set.Make(String)

(** {1 G-Counter: Grow-only Counter} *)
module GCounter = struct
  (** A grow-only counter that can only be incremented *)
  type t = {
    counts: int StringMap.t;  (** Per-node increment counts *)
  } [@@deriving yojson]

  (** Create an empty G-Counter *)
  let empty : t = { counts = StringMap.empty }

  (** Increment the counter for a specific node *)
  let increment (node_id : string) (gc : t) : t =
    let current = StringMap.find_opt node_id gc.counts |> Option.value ~default:0 in
    { counts = StringMap.add node_id (current + 1) gc.counts }

  (** Increment by a specific amount *)
  let increment_by (node_id : string) (amount : int) (gc : t) : t =
    if amount < 0 then gc
    else
      let current = StringMap.find_opt node_id gc.counts |> Option.value ~default:0 in
      { counts = StringMap.add node_id (current + amount) gc.counts }

  (** Get the total value of the counter *)
  let value (gc : t) : int =
    StringMap.fold (fun _ v acc -> acc + v) gc.counts 0

  (** Merge two G-Counters by taking max of each node's count *)
  let merge (gc1 : t) (gc2 : t) : t =
    let counts = StringMap.merge
      (fun _key v1 v2 ->
        let c1 = Option.value v1 ~default:0 in
        let c2 = Option.value v2 ~default:0 in
        Some (max c1 c2))
      gc1.counts gc2.counts
    in
    { counts }

  (** Compare two G-Counters (for partial ordering) *)
  let compare (gc1 : t) (gc2 : t) : int =
    Stdlib.compare (value gc1) (value gc2)
end

(** {1 PN-Counter: Positive-Negative Counter} *)
module PNCounter = struct
  (** A counter that supports both increment and decrement *)
  type t = {
    positive: GCounter.t;  (** Increments *)
    negative: GCounter.t;  (** Decrements *)
  } [@@deriving yojson]

  (** Create an empty PN-Counter *)
  let empty : t = {
    positive = GCounter.empty;
    negative = GCounter.empty;
  }

  (** Increment the counter *)
  let increment (node_id : string) (pn : t) : t =
    { pn with positive = GCounter.increment node_id pn.positive }

  (** Decrement the counter *)
  let decrement (node_id : string) (pn : t) : t =
    { pn with negative = GCounter.increment node_id pn.negative }

  (** Increment by a specific amount *)
  let increment_by (node_id : string) (amount : int) (pn : t) : t =
    if amount >= 0 then
      { pn with positive = GCounter.increment_by node_id amount pn.positive }
    else
      { pn with negative = GCounter.increment_by node_id (-amount) pn.negative }

  (** Get the value of the counter *)
  let value (pn : t) : int =
    GCounter.value pn.positive - GCounter.value pn.negative

  (** Merge two PN-Counters *)
  let merge (pn1 : t) (pn2 : t) : t = {
    positive = GCounter.merge pn1.positive pn2.positive;
    negative = GCounter.merge pn1.negative pn2.negative;
  }
end

(** {1 G-Set: Grow-only Set} *)
module GSet = struct
  (** A set that only supports adding elements *)
  type 'a t = {
    elements: 'a list;  (** Using list for JSON serialization *)
  }

  (** Create an empty G-Set *)
  let empty : 'a t = { elements = [] }

  (** Add an element to the set *)
  let add (elem : 'a) (gs : 'a t) : 'a t =
    if List.mem elem gs.elements then gs
    else { elements = elem :: gs.elements }

  (** Check if an element is in the set *)
  let contains (elem : 'a) (gs : 'a t) : bool =
    List.mem elem gs.elements

  (** Get all elements *)
  let elements (gs : 'a t) : 'a list = gs.elements

  (** Merge two G-Sets by union *)
  let merge (gs1 : 'a t) (gs2 : 'a t) : 'a t =
    let combined = gs1.elements @ gs2.elements in
    let unique = List.sort_uniq Stdlib.compare combined in
    { elements = unique }

  (** Get the size of the set *)
  let size (gs : 'a t) : int = List.length gs.elements
end

(** {1 2P-Set: Two-Phase Set} *)
module TwoPhaseSet = struct
  (** A set that supports add and remove (but removed elements can't be re-added) *)
  type 'a t = {
    added: 'a GSet.t;
    removed: 'a GSet.t;
  }

  (** Create an empty 2P-Set *)
  let empty : 'a t = {
    added = GSet.empty;
    removed = GSet.empty;
  }

  (** Add an element *)
  let add (elem : 'a) (tps : 'a t) : 'a t =
    { tps with added = GSet.add elem tps.added }

  (** Remove an element *)
  let remove (elem : 'a) (tps : 'a t) : 'a t =
    { tps with removed = GSet.add elem tps.removed }

  (** Check if an element is in the set *)
  let contains (elem : 'a) (tps : 'a t) : bool =
    GSet.contains elem tps.added && not (GSet.contains elem tps.removed)

  (** Get all elements currently in the set *)
  let elements (tps : 'a t) : 'a list =
    List.filter (fun e -> not (GSet.contains e tps.removed)) (GSet.elements tps.added)

  (** Merge two 2P-Sets *)
  let merge (tps1 : 'a t) (tps2 : 'a t) : 'a t = {
    added = GSet.merge tps1.added tps2.added;
    removed = GSet.merge tps1.removed tps2.removed;
  }
end

(** {1 LWW-Register: Last-Writer-Wins Register} *)
module LWWRegister = struct
  (** A register where the most recent write wins *)
  type 'a t = {
    value: 'a option;
    timestamp: int;
    node_id: string;
  } [@@deriving yojson]

  (** Create an empty register *)
  let empty : 'a t = {
    value = None;
    timestamp = 0;
    node_id = "";
  }

  (** Set the value with a timestamp *)
  let set (v : 'a) (ts : int) (node : string) (reg : 'a t) : 'a t =
    if ts > reg.timestamp || (ts = reg.timestamp && node > reg.node_id) then
      { value = Some v; timestamp = ts; node_id = node }
    else
      reg

  (** Get the current value *)
  let get (reg : 'a t) : 'a option = reg.value

  (** Merge two registers (last writer wins) *)
  let merge (reg1 : 'a t) (reg2 : 'a t) : 'a t =
    if reg1.timestamp > reg2.timestamp then reg1
    else if reg2.timestamp > reg1.timestamp then reg2
    else if reg1.node_id >= reg2.node_id then reg1
    else reg2
end

(** {1 LWW-Element-Set: Last-Writer-Wins Element Set} *)
module LWWElementSet = struct
  (** An element with add/remove timestamps *)
  type 'a element = {
    value: 'a;
    add_time: int;
    remove_time: int option;
  }

  (** The LWW-Element-Set *)
  type 'a t = {
    elements: 'a element list;
  }

  (** Create an empty set *)
  let empty : 'a t = { elements = [] }

  (** Find an element by value *)
  let find_element (v : 'a) (lww : 'a t) : 'a element option =
    List.find_opt (fun e -> e.value = v) lww.elements

  (** Add an element with timestamp *)
  let add (v : 'a) (ts : int) (lww : 'a t) : 'a t =
    match find_element v lww with
    | Some existing ->
      if ts > existing.add_time then
        let updated = { existing with add_time = ts } in
        let others = List.filter (fun e -> e.value <> v) lww.elements in
        { elements = updated :: others }
      else lww
    | None ->
      { elements = { value = v; add_time = ts; remove_time = None } :: lww.elements }

  (** Remove an element with timestamp *)
  let remove (v : 'a) (ts : int) (lww : 'a t) : 'a t =
    match find_element v lww with
    | Some existing ->
      let new_remove_time = match existing.remove_time with
        | Some rt -> Some (max rt ts)
        | None -> Some ts
      in
      let updated = { existing with remove_time = new_remove_time } in
      let others = List.filter (fun e -> e.value <> v) lww.elements in
      { elements = updated :: others }
    | None ->
      { elements = { value = v; add_time = 0; remove_time = Some ts } :: lww.elements }

  (** Check if element is in the set (add_time > remove_time) *)
  let contains (v : 'a) (lww : 'a t) : bool =
    match find_element v lww with
    | Some e ->
      begin match e.remove_time with
        | Some rt -> e.add_time > rt
        | None -> true
      end
    | None -> false

  (** Get all elements currently in the set *)
  let elements (lww : 'a t) : 'a list =
    lww.elements
    |> List.filter (fun e ->
        match e.remove_time with
        | Some rt -> e.add_time > rt
        | None -> true)
    |> List.map (fun e -> e.value)

  (** Merge two LWW-Element-Sets *)
  let merge (lww1 : 'a t) (lww2 : 'a t) : 'a t =
    let merge_element e1 e2 = {
      value = e1.value;
      add_time = max e1.add_time e2.add_time;
      remove_time = match e1.remove_time, e2.remove_time with
        | Some t1, Some t2 -> Some (max t1 t2)
        | Some t, None | None, Some t -> Some t
        | None, None -> None;
    } in
    let all_values =
      (List.map (fun e -> e.value) lww1.elements) @
      (List.map (fun e -> e.value) lww2.elements)
      |> List.sort_uniq Stdlib.compare
    in
    let merged_elements = List.map (fun v ->
      let e1 = find_element v lww1 in
      let e2 = find_element v lww2 in
      match e1, e2 with
      | Some el1, Some el2 -> merge_element el1 el2
      | Some el, None | None, Some el -> el
      | None, None -> { value = v; add_time = 0; remove_time = None }
    ) all_values in
    { elements = merged_elements }
end

(** {1 OR-Set: Observed-Remove Set} *)
module ORSet = struct
  (** A tagged element with unique identifier *)
  type 'a tagged = {
    value: 'a;
    tag: string;  (** Unique tag for this add operation *)
  }

  (** The OR-Set *)
  type 'a t = {
    elements: 'a tagged list;  (** Active elements *)
    tombstones: string list;   (** Removed tags *)
  }

  (** Create an empty OR-Set *)
  let empty : 'a t = { elements = []; tombstones = [] }

  (** Generate a unique tag *)
  let generate_tag () : string =
    Printf.sprintf "%d-%d" (Random.int 1000000) (int_of_float (Unix.time ()))

  (** Add an element with a new unique tag *)
  let add (v : 'a) (or_set : 'a t) : 'a t =
    let tag = generate_tag () in
    { or_set with elements = { value = v; tag } :: or_set.elements }

  (** Add with a specific tag (for deterministic testing) *)
  let add_with_tag (v : 'a) (tag : string) (or_set : 'a t) : 'a t =
    { or_set with elements = { value = v; tag } :: or_set.elements }

  (** Remove all occurrences of a value *)
  let remove (v : 'a) (or_set : 'a t) : 'a t =
    let to_remove = List.filter (fun e -> e.value = v) or_set.elements in
    let new_tombstones = List.map (fun e -> e.tag) to_remove in
    let remaining = List.filter (fun e -> e.value <> v) or_set.elements in
    { elements = remaining; tombstones = or_set.tombstones @ new_tombstones }

  (** Check if element is in the set *)
  let contains (v : 'a) (or_set : 'a t) : bool =
    List.exists (fun e ->
      e.value = v && not (List.mem e.tag or_set.tombstones)
    ) or_set.elements

  (** Get all unique values in the set *)
  let elements (or_set : 'a t) : 'a list =
    or_set.elements
    |> List.filter (fun e -> not (List.mem e.tag or_set.tombstones))
    |> List.map (fun e -> e.value)
    |> List.sort_uniq Stdlib.compare

  (** Merge two OR-Sets *)
  let merge (or1 : 'a t) (or2 : 'a t) : 'a t =
    let all_elements = or1.elements @ or2.elements in
    let all_tombstones = or1.tombstones @ or2.tombstones |> List.sort_uniq String.compare in
    let unique_elements =
      all_elements
      |> List.sort_uniq (fun e1 e2 -> String.compare e1.tag e2.tag)
      |> List.filter (fun e -> not (List.mem e.tag all_tombstones))
    in
    { elements = unique_elements; tombstones = all_tombstones }
end

(** {1 MV-Register: Multi-Value Register} *)
module MVRegister = struct
  (** A register that keeps all concurrent values *)
  type 'a t = {
    values: ('a * Vector_clock.t) list;
  }

  (** Create an empty register *)
  let empty : 'a t = { values = [] }

  (** Set a value with its vector clock *)
  let set (v : 'a) (vc : Vector_clock.t) (reg : 'a t) : 'a t =
    (* Remove values that are dominated by the new value *)
    let dominated = List.filter (fun (_, vc') ->
      not (Vector_clock.happened_before vc' vc)
    ) reg.values in
    (* Add the new value if it's not dominated *)
    let dominated_by_existing = List.exists (fun (_, vc') ->
      Vector_clock.happened_before vc vc'
    ) dominated in
    if dominated_by_existing then
      { values = dominated }
    else
      { values = (v, vc) :: dominated }

  (** Get all concurrent values *)
  let get (reg : 'a t) : 'a list =
    List.map fst reg.values

  (** Check if there are concurrent values (conflict) *)
  let has_conflict (reg : 'a t) : bool =
    List.length reg.values > 1

  (** Merge two MV-Registers *)
  let merge (reg1 : 'a t) (reg2 : 'a t) : 'a t =
    let all_values = reg1.values @ reg2.values in
    (* Keep only values that are not dominated by any other *)
    let not_dominated = List.filter (fun (_, vc) ->
      not (List.exists (fun (_, vc') ->
        vc <> vc' && Vector_clock.happened_before vc vc'
      ) all_values)
    ) all_values in
    (* Remove duplicates *)
    let unique = List.sort_uniq (fun (v1, _) (v2, _) -> Stdlib.compare v1 v2) not_dominated in
    { values = unique }
end