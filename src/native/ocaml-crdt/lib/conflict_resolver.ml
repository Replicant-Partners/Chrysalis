(** Conflict Resolution using Social Choice Theory principles.

    This module provides immutable conflict detection and resolution for
    multi-agent persona evaluation outputs. It implements various resolution
    strategies including weighted averaging, conservative merging, and
    human escalation triggers.
*)

module StringMap = Map.Make(String)

(** {1 Types and Configuration} *)

(** Threshold configuration for conflict detection *)
type thresholds = {
  risk_disagreement: float;      (** Max allowed risk score difference *)
  overconfidence_risk: int;      (** Overconfidence threshold *)
  phil_confidence: float;        (** Phil confidence threshold *)
  threshold_boundary_low: float; (** Lower boundary for uncertain decisions *)
  threshold_boundary_high: float;(** Upper boundary for uncertain decisions *)
  blind_spots_minimum: int;      (** Min blind spots triggering escalation *)
  confidence_reduction: float;   (** Confidence reduction factor *)
  unanimous_confidence: float;   (** Threshold for unanimous concern *)
} [@@deriving yojson]

(** Default threshold configuration *)
let default_thresholds : thresholds = {
  risk_disagreement = 0.3;
  overconfidence_risk = 7;
  phil_confidence = 0.7;
  threshold_boundary_low = 0.28;
  threshold_boundary_high = 0.32;
  blind_spots_minimum = 3;
  confidence_reduction = 0.8;
  unanimous_confidence = 0.85;
}

(** Conflict types that can be detected *)
type conflict_type =
  | RiskDisagreement      (** Significant disagreement on risk scores *)
  | ConfidenceMismatch    (** Overconfidence detected with high phil confidence *)
  | ThresholdBoundary     (** Risk score near decision threshold *)
  | BlindSpot             (** Multiple blind spots identified *)
  | UnanimousConcern      (** All personas showing high confidence concern *)
  [@@deriving yojson]

(** Resolution strategies *)
type resolution_strategy =
  | WeightedAverage   (** Combine scores with weights *)
  | ConservativeMerge (** Take the more cautious option *)
  | HumanEscalation   (** Escalate to human review *)
  [@@deriving yojson]

(** A detected conflict *)
type conflict = {
  conflict_type: conflict_type;
  personas: string list;      (** Personas involved in conflict *)
  severity: float;            (** Severity from 0.0 to 1.0 *)
  description: string;        (** Human-readable description *)
  data: Yojson.Safe.t option; (** Additional conflict data *)
} [@@deriving yojson]

(** A resolution for a conflict *)
type resolution = {
  original_conflict: conflict;
  strategy: resolution_strategy;
  adjustment: float;          (** Confidence adjustment to apply *)
  resolved: bool;             (** Whether conflict was fully resolved *)
  explanation: string;        (** Explanation of resolution *)
} [@@deriving yojson]

(** Aggregated resolution result *)
type resolution_result = {
  total_adjustment: float;        (** Combined adjustment (capped at -0.4) *)
  requires_human_review: bool;    (** Whether human review is needed *)
  explanations: string list;      (** All resolution explanations *)
  final_confidence_cap: float;    (** Maximum allowed confidence *)
  conflicts_detected: int;        (** Number of conflicts found *)
  conflicts_resolved: int;        (** Number of conflicts resolved *)
} [@@deriving yojson]

(** Persona evaluation output *)
type persona_output = {
  persona_id: string;
  risk_score: float option;
  confidence: float;
  scorecard: scorecard option;
} [@@deriving yojson]

(** Persona scorecard with additional metrics *)
and scorecard = {
  overconfidence_risk: int option;
  blind_spots: string list;
} [@@deriving yojson]

(** {1 Conflict Detection} *)

(** Get resolution strategy and adjustment for a conflict type *)
let strategy_for_conflict_type (ct : conflict_type) : resolution_strategy * float =
  match ct with
  | RiskDisagreement -> (WeightedAverage, -0.1)
  | ConfidenceMismatch -> (ConservativeMerge, -0.2)
  | ThresholdBoundary -> (HumanEscalation, -0.2)
  | BlindSpot -> (HumanEscalation, -0.2)
  | UnanimousConcern -> (ConservativeMerge, -0.15)

(** Detect risk disagreement between personas *)
let detect_risk_disagreement
    (thresholds : thresholds)
    (personas : persona_output list) : conflict option =
  (* Find personas with risk scores *)
  let with_risk = List.filter_map (fun p ->
    match p.risk_score with
    | Some rs -> Some (p.persona_id, rs)
    | None -> None
  ) personas in

  match with_risk with
  | [] | [_] -> None
  | _ ->
    (* Find max difference between any two risk scores *)
    let scores = List.map snd with_risk in
    let max_score = List.fold_left max 0.0 scores in
    let min_score = List.fold_left min 1.0 scores in
    let diff = max_score -. min_score in

    if diff > thresholds.risk_disagreement then
      let involved = List.map fst with_risk in
      Some {
        conflict_type = RiskDisagreement;
        personas = involved;
        severity = Float.min 1.0 (diff /. 0.5);  (* Normalize to 0-1 *)
        description = Printf.sprintf
          "Risk score disagreement of %.2f between personas (threshold: %.2f)"
          diff thresholds.risk_disagreement;
        data = Some (`Assoc [
          ("max_risk", `Float max_score);
          ("min_risk", `Float min_score);
          ("difference", `Float diff);
        ]);
      }
    else
      None

(** Detect confidence mismatch (overconfidence + high phil confidence) *)
let detect_confidence_mismatch
    (thresholds : thresholds)
    (personas : persona_output list) : conflict option =
  (* Find david's overconfidence risk *)
  let david_overconfidence = List.find_map (fun p ->
    if p.persona_id = "david" then
      match p.scorecard with
      | Some sc -> sc.overconfidence_risk
      | None -> None
    else None
  ) personas in

  (* Find phil's confidence *)
  let phil_confidence = List.find_map (fun p ->
    if p.persona_id = "phil" then Some p.confidence
    else None
  ) personas in

  match david_overconfidence, phil_confidence with
  | Some overconf, Some phil_conf
    when overconf > thresholds.overconfidence_risk
      && phil_conf > thresholds.phil_confidence ->
    Some {
      conflict_type = ConfidenceMismatch;
      personas = ["david"; "phil"];
      severity = Float.min 1.0
        ((float_of_int overconf /. 10.0) *. phil_conf);
      description = Printf.sprintf
        "David overconfidence risk %d > %d with Phil confidence %.2f > %.2f"
        overconf thresholds.overconfidence_risk
        phil_conf thresholds.phil_confidence;
      data = Some (`Assoc [
        ("overconfidence_risk", `Int overconf);
        ("phil_confidence", `Float phil_conf);
      ]);
    }
  | _ -> None

(** Detect threshold boundary condition *)
let detect_threshold_boundary
    (thresholds : thresholds)
    (personas : persona_output list) : conflict option =
  (* Calculate average risk score *)
  let risk_scores = List.filter_map (fun p -> p.risk_score) personas in
  if List.length risk_scores = 0 then None
  else
    let avg_risk =
      (List.fold_left (+.) 0.0 risk_scores) /.
      (float_of_int (List.length risk_scores)) in

    if avg_risk >= thresholds.threshold_boundary_low
       && avg_risk <= thresholds.threshold_boundary_high then
      Some {
        conflict_type = ThresholdBoundary;
        personas = List.filter_map (fun p ->
          if Option.is_some p.risk_score then Some p.persona_id else None
        ) personas;
        severity = 0.8;  (* High severity for boundary cases *)
        description = Printf.sprintf
          "Average risk %.3f is near decision boundary [%.2f, %.2f]"
          avg_risk thresholds.threshold_boundary_low
          thresholds.threshold_boundary_high;
        data = Some (`Assoc [
          ("average_risk", `Float avg_risk);
          ("boundary_low", `Float thresholds.threshold_boundary_low);
          ("boundary_high", `Float thresholds.threshold_boundary_high);
        ]);
      }
    else None

(** Detect blind spots *)
let detect_blind_spots
    (thresholds : thresholds)
    (personas : persona_output list) : conflict option =
  (* Find david's blind spots *)
  let blind_spots = List.find_map (fun p ->
    if p.persona_id = "david" then
      match p.scorecard with
      | Some sc -> Some sc.blind_spots
      | None -> None
    else None
  ) personas in

  match blind_spots with
  | Some spots when List.length spots >= thresholds.blind_spots_minimum ->
    Some {
      conflict_type = BlindSpot;
      personas = ["david"];
      severity = Float.min 1.0
        (float_of_int (List.length spots) /. 5.0);
      description = Printf.sprintf
        "Detected %d blind spots (minimum: %d): %s"
        (List.length spots) thresholds.blind_spots_minimum
        (String.concat ", " spots);
      data = Some (`Assoc [
        ("blind_spots", `List (List.map (fun s -> `String s) spots));
        ("count", `Int (List.length spots));
      ]);
    }
  | _ -> None

(** Detect unanimous concern (high average confidence) *)
let detect_unanimous_concern
    (thresholds : thresholds)
    (personas : persona_output list) : conflict option =
  let confidences = List.map (fun p -> p.confidence) personas in
  if List.length confidences = 0 then None
  else
    let avg_confidence =
      (List.fold_left (+.) 0.0 confidences) /.
      (float_of_int (List.length confidences)) in

    if avg_confidence > thresholds.unanimous_confidence then
      Some {
        conflict_type = UnanimousConcern;
        personas = List.map (fun p -> p.persona_id) personas;
        severity = (avg_confidence -. thresholds.unanimous_confidence) /. 0.15;
        description = Printf.sprintf
          "Average confidence %.2f exceeds unanimous threshold %.2f"
          avg_confidence thresholds.unanimous_confidence;
        data = Some (`Assoc [
          ("average_confidence", `Float avg_confidence);
          ("threshold", `Float thresholds.unanimous_confidence);
        ]);
      }
    else None

(** Detect all conflicts in persona outputs *)
let detect_conflicts
    ?(thresholds = default_thresholds)
    (personas : persona_output list) : conflict list =
  let detectors = [
    detect_risk_disagreement thresholds;
    detect_confidence_mismatch thresholds;
    detect_threshold_boundary thresholds;
    detect_blind_spots thresholds;
    detect_unanimous_concern thresholds;
  ] in
  List.filter_map (fun detect -> detect personas) detectors

(** {1 Conflict Resolution} *)

(** Resolve a single conflict *)
let resolve_conflict (conflict : conflict) : resolution =
  let (strategy, adjustment) = strategy_for_conflict_type conflict.conflict_type in
  let resolved = match strategy with
    | HumanEscalation -> false  (* Human escalation means not auto-resolved *)
    | _ -> true
  in
  let explanation = match strategy with
    | WeightedAverage ->
      Printf.sprintf "Applied weighted average to resolve %s"
        conflict.description
    | ConservativeMerge ->
      Printf.sprintf "Applied conservative merge strategy: %s"
        conflict.description
    | HumanEscalation ->
      Printf.sprintf "Escalating to human review: %s"
        conflict.description
  in
  {
    original_conflict = conflict;
    strategy;
    adjustment;
    resolved;
    explanation;
  }

(** Resolve all conflicts *)
let resolve_conflicts (conflicts : conflict list) : resolution list =
  List.map resolve_conflict conflicts

(** Aggregate resolutions into final result *)
let aggregate_resolutions (resolutions : resolution list) : resolution_result =
  let total_adjustment =
    List.fold_left (fun acc r -> acc +. r.adjustment) 0.0 resolutions in
  let capped_adjustment = Float.max (-0.4) total_adjustment in

  let requires_human = List.exists (fun r ->
    not r.resolved || r.strategy = HumanEscalation
  ) resolutions in

  let explanations = List.map (fun r -> r.explanation) resolutions in

  let resolved_count = List.length (List.filter (fun r -> r.resolved) resolutions) in

  {
    total_adjustment = capped_adjustment;
    requires_human_review = requires_human;
    explanations;
    final_confidence_cap = 1.0 +. capped_adjustment;
    conflicts_detected = List.length resolutions;
    conflicts_resolved = resolved_count;
  }

(** {1 Main API} *)

(** Full conflict resolution pipeline: detect, resolve, aggregate *)
let resolve_persona_conflicts
    ?(thresholds = default_thresholds)
    (personas : persona_output list) : resolution_result =
  let conflicts = detect_conflicts ~thresholds personas in
  let resolutions = resolve_conflicts conflicts in
  aggregate_resolutions resolutions

(** Check if persona outputs have any conflicts *)
let has_conflicts
    ?(thresholds = default_thresholds)
    (personas : persona_output list) : bool =
  List.length (detect_conflicts ~thresholds personas) > 0

(** {1 Serialization} *)

(** Convert conflict type to string *)
let string_of_conflict_type = function
  | RiskDisagreement -> "risk_disagreement"
  | ConfidenceMismatch -> "confidence_mismatch"
  | ThresholdBoundary -> "threshold_boundary"
  | BlindSpot -> "blind_spot"
  | UnanimousConcern -> "unanimous_concern"

(** Convert resolution strategy to string *)
let string_of_strategy = function
  | WeightedAverage -> "weighted_average"
  | ConservativeMerge -> "conservative_merge"
  | HumanEscalation -> "human_escalation"

(** Convert resolution result to JSON *)
let resolution_result_to_json (result : resolution_result) : Yojson.Safe.t =
  `Assoc [
    ("total_adjustment", `Float result.total_adjustment);
    ("requires_human_review", `Bool result.requires_human_review);
    ("explanations", `List (List.map (fun s -> `String s) result.explanations));
    ("final_confidence_cap", `Float result.final_confidence_cap);
    ("conflicts_detected", `Int result.conflicts_detected);
    ("conflicts_resolved", `Int result.conflicts_resolved);
  ]
