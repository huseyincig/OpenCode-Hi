# M8 Authority / Ambiguous External-Action Replay

- Date: 2026-08-18
- Current: `42c1cd6e70c124c7c2aebc133bf968eae53bbea2`
- Pre-reset: `e8c1a7d77f3546bb2f940f4e7b439ed06a273e83`
- Fixture SHA256: `fe14c844a3f91e891c21ae34374d05b64122536fcaed367717a7425b51128fe7`
- Aggregate: `/workspace/Reference/benchmarks/m8-authority-replay/aggregate.json`
- Aggregate SHA256: `1df6aaea835fab06dacb084773c767ae0ccc34c12da291766d87a7a0654daad4`

## Decision

**RETAIN_UNCHANGED exact-action authority/idempotency.** Both pre-reset and current pass all deterministic replay/ambiguity checks, and `runtime/safety/authority.ts` has no implementation diff between the compared commits. This is a preserved correctness-critical safety invariant, not evidence of reset-specific superiority.

No real external action, provider/model inference, or monetary cost occurred.
