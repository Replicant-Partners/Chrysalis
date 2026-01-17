(** Conflict Resolution using Social Choice Theory principles.

    This module provides immutable conflict detection and resolution for
    multi-agent persona evaluation outputs.
*)

(** {1 Configuration Types} *)

(** Threshold configuration for conflict detection *)
type thresholds = {
  risk_disagreement: float;
  overconfidence_risk: int;
  phil_confidence: float;
  threshold_boundary_low: float;
  threshold_boundary_high: float;
  blind_spots_minimum: int;
  confidence_reduction: float;
  unanimous_confidence: float;
}

(** Default threshold configuration *)
val default_thresholds : thresholds

(** {1 Conflict Types} *)

(** Types of conflicts that can be detected *)
type conflict_type =
  | RiskDisagreement      (** Significant disagreement on risk scores *)
  | ConfidenceMismatch    (** Overconfidence detected *)
  | ThresholdBoundary     (** Risk score near decision threshold *)
  | BlindSpot             (** Multiple blind spots identified *)
  | UnanimousConcern      (** All personas showing high confidence *)

(** Resolution strategies *)
type resolution_strategy =
  | WeightedAverage
  | ConservativeMerge
  | HumanEscalation

(** A detected conflict *)
type conflict = {
  conflict_type: conflict_type;
  personas: string list;
  severity: float;
  description: string;
  data: Yojson.Safe.t option;
}

(** A resolution for a conflict *)
type resolution = {
  original_conflict: conflict;
  strategy: resolution_strategy;
  adjustment: float;
  resolved: bool;
  explanation: string;
}

(** Aggregated resolution result *)
type resolution_result = {
  total_adjustment: float;
  requires_human_review: bool;
  explanations: string list;
  final_confidence_cap: float;
  conflicts_detected: int;
  conflicts_resolved: int;
}

(** {1 Input Types} *)

(** Persona scorecard *)
type scorecard = {
  overconfidence_risk: int option;
  blind_spots: string list;
}

(** Persona evaluation output *)
type persona_output = {
  persona_id: string;
  risk_score: float option;
  confidence: float;
  scorecard: scorecard option;
}

(** {1 Detection Functions} *)

(** Detect all conflicts in persona outputs *)
val detect_conflicts :
  ?thresholds:thresholds ->
  persona_output list ->
  conflict list

(** Check if any conflicts exist *)
val has_conflicts :
  ?thresholds:thresholds ->
  persona_output list ->
  bool

(** {1 Resolution Functions} *)

(** Resolve a single conflict *)
val resolve_conflict : conflict -> resolution

(** Resolve all conflicts *)
val resolve_conflicts : conflict list -> resolution list

(** Aggregate resolutions into final result *)
val aggregate_resolutions : resolution list -> resolution_result

(** {1 Main API} *)

(** Full pipeline: detect, resolve, and aggregate *)
val resolve_persona_conflicts :
  ?thresholds:thresholds ->
  persona_output list ->
  resolution_result

(** {1 Serialization} *)

val string_of_conflict_type : conflict_type -> string
val string_of_strategy : resolution_strategy -> string
val resolution_result_to_json : resolution_result -> Yojson.Safe.t
