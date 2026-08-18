# M8 Plugin / Config Coexistence

- Date: 2026-08-18
- Current: `42c1cd6e70c124c7c2aebc133bf968eae53bbea2`
- Pre-reset: `e8c1a7d77f3546bb2f940f4e7b439ed06a273e83`
- Fixture SHA256: `69ccadf595b8f7a0fff53c8d41b3f5f71c4086089fe3ee875984cc7c9239f6d9`
- Aggregate: `/workspace/Reference/benchmarks/m8-coexistence/aggregate.json`
- Aggregate SHA256: `c60a20622b49c53340a9b870c46cc6905bdade112b03ea8a20f70a18297ad9a6`

## Decision

**RETAIN composition adapter and idempotent coexistence transforms; KEEP_REMOVED `default_agent` ownership.** Current passes all 16 deterministic preservation/idempotency checks. Pre-reset mutates V2 config with V1 fields, claims `default_agent`, suppresses canonical message projection under foreign marker text, and duplicates system/compaction projections across repeated hooks.

No provider/model inference or monetary cost occurred.
