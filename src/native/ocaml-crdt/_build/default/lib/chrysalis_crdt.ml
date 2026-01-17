(** Chrysalis CRDT Library

    Main entry point exposing all CRDT types for the Chrysalis
    distributed agent framework.
*)

module Vector_clock = Vector_clock
module Crdt = Crdt
module Experience = Experience

(** Re-export commonly used types *)
module GCounter = Crdt.GCounter
module PNCounter = Crdt.PNCounter
module GSet = Crdt.GSet
module TwoPhaseSet = Crdt.TwoPhaseSet
module LWWRegister = Crdt.LWWRegister
module LWWElementSet = Crdt.LWWElementSet
module ORSet = Crdt.ORSet
module MVRegister = Crdt.MVRegister

module SkillAccumulator = Experience.SkillAccumulator
module EpisodeMemory = Experience.EpisodeMemory
module BeliefState = Experience.BeliefState
module AgentState = Experience.AgentState

(** Conflict Resolution *)
module Conflict_resolver = Conflict_resolver