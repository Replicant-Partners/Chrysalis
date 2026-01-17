# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security
- Enforce JWT secret requirement in production for both TypeScript and Python auth modules.
- Add request-body size guard and invalid JSON detection in shared HTTP parsing utilities.
- Return 413 for oversized payloads in system-agent endpoints.

### Observability
- Lazy-load OpenTelemetry auto-instrumentation to avoid test-time failures.

### Logging
- Bound adapter and job event logging payloads to prevent oversized JSONL entries.

### Documentation
- Add OpenAPI specification for internal System Agents API.

