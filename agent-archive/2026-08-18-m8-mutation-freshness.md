# M8 Mutation-After-Verification Freshness

- Date: 2026-08-18
- Current: `42c1cd6e70c124c7c2aebc133bf968eae53bbea2`
- Pre-reset: `e8c1a7d77f3546bb2f940f4e7b439ed06a273e83`
- Fixture SHA256: `3b7abaf47157f234254987c254a4dc8c42a06a98866e974419e4e235c2544554`
- Aggregate: `/workspace/Reference/benchmarks/m8-mutation-freshness/aggregate.json`
- Aggregate SHA256: `12403aac5b7eaf8aee01829a1e95b59206ab3f72b556fca3df39f5a64d372581`

## Decision

**RETAIN scoped evidence freshness and affected-claim reopening.** Current passes all seven deterministic acceptance checks. Relevant and unknown mutations block stale completion; relevant invalidation reopens the affected verification obligation and gate; unrelated known-surface mutations preserve independent proof; fresh re-verification restores completion.

Pre-reset blocks stale completion but leaves the persisted verification claim/gate closed and blanket-invalidates unrelated evidence, creating avoidable re-verification. No false completion was observed in this fixture.

Vanilla is not treated as equivalent because this is a Hi evidence/claim-state contract. No provider/model execution or monetary cost occurred.
