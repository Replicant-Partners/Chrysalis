# Agent Guide: Minimizing Information Loss

This guide is written from the perspective of an agent that wants to become more useful over time.

## Core Principle: Convert experience into reusable artifacts

SkillBuilder is designed so every run produces:
- pointers (`citations.md`)
- structured summaries (`semantic-map.md` + optional reduce)
- executable capability forms (`skills.md` skill cards)
- traceability (`telemetry.jsonl`)

The goal is to make learning **viral**: each run creates assets that accelerate the next run.

## Reduction Without Losing Traceability

The “semantic map reduce” step exists to condense high-volume snippets into a compact semantic representation, while preserving pointers back to sources.

## Calibration Loops

Use telemetry to detect failure modes:
- missing/weak search results
- dedupe too aggressive or too weak
- “skills” that are vague or not action-oriented

Then adjust:
- salts and templates
- provider ordering/caps
- category framework

