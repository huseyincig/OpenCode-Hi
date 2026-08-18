# M8 Provider / Child Recovery Ownership

- Date: 2026-08-18
- Current: `42c1cd6e70c124c7c2aebc133bf968eae53bbea2`
- Pre-reset: `e8c1a7d77f3546bb2f940f4e7b439ed06a273e83`
- Fixture SHA256: `ae9d584f952dd711378dd8c73730e69b568750a520d75707660aa94146679406`
- Aggregate: `/workspace/Reference/benchmarks/m8-provider-recovery/aggregate.json`
- Aggregate SHA256: `568f24680004f9897a796bad82762fa7996d0ed1914bd166b4b5c20b51aee7f9`

## Decision

**RETAIN provider/child recovery ownership and scheduler fencing.** With a fallback prompt transport failure followed by an injected inability to abort the new recovery child, current keeps that child tracked, retains scheduler ownership, emits an exact blocker, and refuses further fallback dispatch.

Pre-reset spawns two fallback children without quiescing either, releases scheduler ownership, and ends with a busy child attached to a blocked task. Mechanically observed: duplicate dispatch=1, unquiesced recovery children=2, retries=2 versus current duplicate dispatch=0 and retries=1.

No provider/model inference or monetary cost occurred; the host port was deterministic failure injection.
