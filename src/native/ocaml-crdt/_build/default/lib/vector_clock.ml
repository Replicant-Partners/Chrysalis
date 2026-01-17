(** Vector Clock implementation for distributed causality tracking.

    Vector clocks provide a mechanism to capture the partial ordering of events
    in a distributed system, enabling detection of concurrent vs causally-related
    operations.
*)

module StringMap = Map.Make(String)

(** A vector clock mapping node IDs to logical timestamps *)
type t = int StringMap.t

(** Convert to JSON *)
let to_yojson (vc : t) : Yojson.Safe.t =
  let entries = StringMap.bindings vc in
  `Assoc (List.map (fun (k, v) -> (k, `Int v)) entries)

(** Parse from JSON *)
let of_yojson (json : Yojson.Safe.t) : (t, string) result =
  match json with
  | `Assoc entries ->
    let parse_entry acc (k, v) =
      match acc, v with
      | Ok m, `Int i -> Ok (StringMap.add k i m)
      | Error e, _ -> Error e
      | _, _ -> Error ("Expected int for key: " ^ k)
    in
    List.fold_left parse_entry (Ok StringMap.empty) entries
  | _ -> Error "Expected JSON object for vector clock"

(** Comparison result for vector clocks *)
type comparison =
  | Before      (** vc1 happened before vc2 *)
  | After       (** vc1 happened after vc2 *)
  | Concurrent  (** vc1 and vc2 are concurrent *)
  | Equal       (** vc1 equals vc2 *)

(** Create an empty vector clock *)
let empty : t = StringMap.empty

(** Create a vector clock with a single entry *)
let singleton (node_id : string) (timestamp : int) : t =
  StringMap.singleton node_id timestamp

(** Get the timestamp for a node (defaults to 0) *)
let get (node_id : string) (vc : t) : int =
  StringMap.find_opt node_id vc |> Option.value ~default:0

(** Increment the timestamp for a node *)
let increment (node_id : string) (vc : t) : t =
  let current = get node_id vc in
  StringMap.add node_id (current + 1) vc

(** Merge two vector clocks by taking the maximum of each component *)
let merge (vc1 : t) (vc2 : t) : t =
  StringMap.merge
    (fun _key v1 v2 ->
      let t1 = Option.value v1 ~default:0 in
      let t2 = Option.value v2 ~default:0 in
      Some (max t1 t2))
    vc1 vc2

(** Compare two vector clocks *)
let compare (vc1 : t) (vc2 : t) : comparison =
  let all_keys =
    StringMap.merge (fun _ v1 v2 ->
      match v1, v2 with
      | Some _, _ | _, Some _ -> Some ()
      | None, None -> None
    ) vc1 vc2
    |> StringMap.bindings
    |> List.map fst
  in
  let rec check_all less greater = function
    | [] ->
      begin match less, greater with
        | false, false -> Equal
        | true, false -> Before
        | false, true -> After
        | true, true -> Concurrent
      end
    | key :: rest ->
      let t1 = get key vc1 in
      let t2 = get key vc2 in
      let less' = less || (t1 < t2) in
      let greater' = greater || (t1 > t2) in
      check_all less' greater' rest
  in
  check_all false false all_keys

(** Check if vc1 happened before vc2 *)
let happened_before (vc1 : t) (vc2 : t) : bool =
  compare vc1 vc2 = Before

(** Check if vc1 happened after vc2 *)
let happened_after (vc1 : t) (vc2 : t) : bool =
  compare vc1 vc2 = After

(** Check if two vector clocks are concurrent *)
let concurrent (vc1 : t) (vc2 : t) : bool =
  compare vc1 vc2 = Concurrent

(** Check if two vector clocks are equal *)
let equal (vc1 : t) (vc2 : t) : bool =
  compare vc1 vc2 = Equal

(** Convert to association list *)
let to_list (vc : t) : (string * int) list =
  StringMap.bindings vc

(** Create from association list *)
let of_list (entries : (string * int) list) : t =
  List.fold_left
    (fun acc (k, v) -> StringMap.add k v acc)
    StringMap.empty
    entries

(** Get all node IDs in the vector clock *)
let nodes (vc : t) : string list =
  StringMap.bindings vc |> List.map fst

(** Get the sum of all timestamps (useful for ordering) *)
let sum (vc : t) : int =
  StringMap.fold (fun _ v acc -> acc + v) vc 0

(** Pretty print a vector clock *)
let to_string (vc : t) : string =
  let entries = StringMap.bindings vc in
  let parts = List.map (fun (k, v) -> Printf.sprintf "%s:%d" k v) entries in
  "{" ^ String.concat ", " parts ^ "}"