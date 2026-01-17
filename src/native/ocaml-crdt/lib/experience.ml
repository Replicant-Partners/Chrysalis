(** Experience and Memory CRDT types for Chrysalis agents.

    These types model the accumulation of agent experiences, skills,
    and memories using CRDTs for conflict-free synchronization.
*)

module StringMap = Map.Make(String)

(** {1 Skill Accumulator} *)
module SkillAccumulator = struct
  (** A skill with proficiency tracking *)
  type skill = {
    name: string;
    proficiency: float;  (** 0.0 to 1.0 *)
    usage_count: int;
    last_used: int;      (** Timestamp *)
  } [@@deriving yojson]

  (** Skill accumulator using LWW semantics for each skill *)
  type t = {
    skills: skill StringMap.t;
  }

  (** Create empty accumulator *)
  let empty : t = { skills = StringMap.empty }

  (** Update a skill's proficiency *)
  let update_skill (name : string) (proficiency : float) (timestamp : int) (acc : t) : t =
    let current = StringMap.find_opt name acc.skills in
    let new_skill = match current with
      | Some s when timestamp > s.last_used ->
        { s with
          proficiency = max s.proficiency proficiency;
          usage_count = s.usage_count + 1;
          last_used = timestamp }
      | Some s -> s
      | None ->
        { name; proficiency; usage_count = 1; last_used = timestamp }
    in
    { skills = StringMap.add name new_skill acc.skills }

  (** Merge two skill accumulators *)
  let merge (acc1 : t) (acc2 : t) : t =
    let skills = StringMap.merge (fun _name s1 s2 ->
      match s1, s2 with
      | Some sk1, Some sk2 ->
        (* Take higher proficiency, sum usage counts, latest timestamp *)
        Some {
          name = sk1.name;
          proficiency = max sk1.proficiency sk2.proficiency;
          usage_count = sk1.usage_count + sk2.usage_count;
          last_used = max sk1.last_used sk2.last_used;
        }
      | Some s, None | None, Some s -> Some s
      | None, None -> None
    ) acc1.skills acc2.skills in
    { skills }

  (** Get all skills *)
  let to_list (acc : t) : skill list =
    StringMap.bindings acc.skills |> List.map snd

  (** Get skill by name *)
  let get (name : string) (acc : t) : skill option =
    StringMap.find_opt name acc.skills
end

(** {1 Episode Memory} *)
module EpisodeMemory = struct
  (** An episode representing a discrete experience *)
  type episode = {
    id: string;
    content: string;
    context: string;
    outcome: string;
    timestamp: int;
    importance: float;  (** 0.0 to 1.0 *)
    tags: string list;
  } [@@deriving yojson]

  (** Episode memory using G-Set semantics (episodes are never removed) *)
  type t = {
    episodes: episode list;
    max_episodes: int;  (** For pruning old episodes *)
  }

  (** Create empty memory *)
  let empty ?(max_episodes = 1000) () : t = {
    episodes = [];
    max_episodes
  }

  (** Add an episode *)
  let add (ep : episode) (mem : t) : t =
    if List.exists (fun e -> e.id = ep.id) mem.episodes then
      mem  (* Already exists *)
    else
      let episodes = ep :: mem.episodes in
      (* Prune if over limit, keeping most important *)
      let sorted = List.sort (fun e1 e2 ->
        compare e2.importance e1.importance  (* Descending *)
      ) episodes in
      let pruned =
        if List.length sorted > mem.max_episodes then
          List.filteri (fun i _ -> i < mem.max_episodes) sorted
        else sorted
      in
      { mem with episodes = pruned }

  (** Merge two episode memories *)
  let merge (mem1 : t) (mem2 : t) : t =
    let all_episodes = mem1.episodes @ mem2.episodes in
    let unique = List.sort_uniq (fun e1 e2 -> String.compare e1.id e2.id) all_episodes in
    let sorted = List.sort (fun e1 e2 ->
      compare e2.importance e1.importance
    ) unique in
    let max_eps = max mem1.max_episodes mem2.max_episodes in
    let pruned =
      if List.length sorted > max_eps then
        List.filteri (fun i _ -> i < max_eps) sorted
      else sorted
    in
    { episodes = pruned; max_episodes = max_eps }

  (** Query episodes by tag *)
  let query_by_tag (tag : string) (mem : t) : episode list =
    List.filter (fun ep -> List.mem tag ep.tags) mem.episodes

  (** Query episodes by time range *)
  let query_by_time (start_time : int) (end_time : int) (mem : t) : episode list =
    List.filter (fun ep ->
      ep.timestamp >= start_time && ep.timestamp <= end_time
    ) mem.episodes

  (** Get most recent episodes *)
  let recent (n : int) (mem : t) : episode list =
    mem.episodes
    |> List.sort (fun e1 e2 -> compare e2.timestamp e1.timestamp)
    |> List.filteri (fun i _ -> i < n)

  (** Get most important episodes *)
  let important (n : int) (mem : t) : episode list =
    mem.episodes
    |> List.sort (fun e1 e2 -> compare e2.importance e1.importance)
    |> List.filteri (fun i _ -> i < n)

  (** Get episode count *)
  let size (mem : t) : int = List.length mem.episodes
end

(** {1 Belief State} *)
module BeliefState = struct
  (** A belief with conviction tracking *)
  type belief = {
    id: string;
    content: string;
    conviction: float;       (** 0.0 to 1.0 *)
    evidence_for: int;       (** Supporting evidence count *)
    evidence_against: int;   (** Contradicting evidence count *)
    last_updated: int;
    source: string;
  } [@@deriving yojson]

  (** Belief state using MV-Register semantics for concurrent updates *)
  type t = {
    beliefs: belief StringMap.t;
  }

  (** Create empty belief state *)
  let empty : t = { beliefs = StringMap.empty }

  (** Update a belief *)
  let update (b : belief) (state : t) : t =
    let current = StringMap.find_opt b.id state.beliefs in
    let updated = match current with
      | Some existing when b.last_updated > existing.last_updated ->
        (* Merge evidence counts, take newer conviction *)
        { b with
          evidence_for = existing.evidence_for + b.evidence_for;
          evidence_against = existing.evidence_against + b.evidence_against }
      | Some existing ->
        (* Keep existing but add evidence *)
        { existing with
          evidence_for = existing.evidence_for + b.evidence_for;
          evidence_against = existing.evidence_against + b.evidence_against }
      | None -> b
    in
    { beliefs = StringMap.add b.id updated state.beliefs }

  (** Add supporting evidence for a belief *)
  let add_evidence_for (belief_id : string) (timestamp : int) (state : t) : t =
    match StringMap.find_opt belief_id state.beliefs with
    | Some b ->
      let updated = { b with
        evidence_for = b.evidence_for + 1;
        last_updated = timestamp;
        conviction = min 1.0 (b.conviction +. 0.05) }
      in
      { beliefs = StringMap.add belief_id updated state.beliefs }
    | None -> state

  (** Add contradicting evidence for a belief *)
  let add_evidence_against (belief_id : string) (timestamp : int) (state : t) : t =
    match StringMap.find_opt belief_id state.beliefs with
    | Some b ->
      let updated = { b with
        evidence_against = b.evidence_against + 1;
        last_updated = timestamp;
        conviction = max 0.0 (b.conviction -. 0.05) }
      in
      { beliefs = StringMap.add belief_id updated state.beliefs }
    | None -> state

  (** Merge two belief states *)
  let merge (s1 : t) (s2 : t) : t =
    let beliefs = StringMap.merge (fun _id b1 b2 ->
      match b1, b2 with
      | Some bl1, Some bl2 ->
        (* Use max for evidence counts to avoid double-counting in CRDT merge.
           Sum would violate idempotency: merge(A, A) != A.
           Max is correct for G-Counter semantics where each node tracks its own count. *)
        let combined = {
          id = bl1.id;
          content = if bl1.last_updated >= bl2.last_updated then bl1.content else bl2.content;
          conviction = max bl1.conviction bl2.conviction;
          evidence_for = max bl1.evidence_for bl2.evidence_for;
          evidence_against = max bl1.evidence_against bl2.evidence_against;
          last_updated = max bl1.last_updated bl2.last_updated;
          source = if bl1.last_updated >= bl2.last_updated then bl1.source else bl2.source;
        } in
        Some combined
      | Some b, None | None, Some b -> Some b
      | None, None -> None
    ) s1.beliefs s2.beliefs in
    { beliefs }

  (** Get beliefs above conviction threshold *)
  let confident_beliefs (threshold : float) (state : t) : belief list =
    StringMap.bindings state.beliefs
    |> List.map snd
    |> List.filter (fun b -> b.conviction >= threshold)

  (** Get all beliefs *)
  let to_list (state : t) : belief list =
    StringMap.bindings state.beliefs |> List.map snd
end

(** {1 Unified Agent State CRDT} *)
module AgentState = struct
  (** Complete agent state combining all CRDT types *)
  type t = {
    agent_id: string;
    skills: SkillAccumulator.t;
    episodes: EpisodeMemory.t;
    beliefs: BeliefState.t;
    vector_clock: Vector_clock.t;
    last_sync: int;
  }

  (** Create initial agent state *)
  let create (agent_id : string) : t = {
    agent_id;
    skills = SkillAccumulator.empty;
    episodes = EpisodeMemory.empty ();
    beliefs = BeliefState.empty;
    vector_clock = Vector_clock.singleton agent_id 0;
    last_sync = 0;
  }

  (** Update the vector clock for a local operation *)
  let tick (state : t) : t =
    { state with
      vector_clock = Vector_clock.increment state.agent_id state.vector_clock }

  (** Merge two agent states *)
  let merge (s1 : t) (s2 : t) : t =
    if s1.agent_id <> s2.agent_id then
      failwith "Cannot merge states from different agents"
    else
      {
        agent_id = s1.agent_id;
        skills = SkillAccumulator.merge s1.skills s2.skills;
        episodes = EpisodeMemory.merge s1.episodes s2.episodes;
        beliefs = BeliefState.merge s1.beliefs s2.beliefs;
        vector_clock = Vector_clock.merge s1.vector_clock s2.vector_clock;
        last_sync = max s1.last_sync s2.last_sync;
      }

  (** Update skill and tick clock *)
  let update_skill (name : string) (proficiency : float) (timestamp : int) (state : t) : t =
    let updated = { state with
      skills = SkillAccumulator.update_skill name proficiency timestamp state.skills }
    in
    tick updated

  (** Add episode and tick clock *)
  let add_episode (ep : EpisodeMemory.episode) (state : t) : t =
    let updated = { state with
      episodes = EpisodeMemory.add ep state.episodes }
    in
    tick updated

  (** Update belief and tick clock *)
  let update_belief (b : BeliefState.belief) (state : t) : t =
    let updated = { state with
      beliefs = BeliefState.update b state.beliefs }
    in
    tick updated

  (** Check if states have diverged (concurrent updates) *)
  let has_diverged (s1 : t) (s2 : t) : bool =
    Vector_clock.concurrent s1.vector_clock s2.vector_clock

  (** Get causality relationship between states *)
  let compare_causality (s1 : t) (s2 : t) : Vector_clock.comparison =
    Vector_clock.compare s1.vector_clock s2.vector_clock
end