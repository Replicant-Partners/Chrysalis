# Sanitization & Trust Tiers

## Trust Tiers (recommended)
- **Tier 1: Human-curated** — trusted editors; minimal filtering.
- **Tier 2: Known agents/services** — medium trust; sanitize + rate limit.
- **Tier 3: External/untrusted** — strict filtering, rate limit, review queue.

## Ingest Guards (current)
- Sanitizer hook in `MemoryMerger`: blocks script/HTML/empty/overlong content; configurable.
- Rate limiting per source: configurable window + max (drops events and emits voyeur block).
- Voyeur redaction: hashes/metadata by default; content only on explicit opt-in.

## Recommendations
- Add PII stripping for Tier 2/3: remove emails, phone numbers, secrets before merge.
- Allowlist domains/senders for auto-ingest; route others to review.
- Configure thresholds per tier (similarity and merge acceptance).
- Log provenance (source, hash) and keep audit trail of blocked items.

## Future Hardening
- Signature verification per source instance (Ed25519) before ingest.
- Quarantine/approval queue for low-confidence matches.
- Per-source quotas and exponential backoff on repeated violations.
