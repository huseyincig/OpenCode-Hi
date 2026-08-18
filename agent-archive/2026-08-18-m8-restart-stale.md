# M8 Restart / Stale Callback Fencing

- Date: 2026-08-18
- Current: `42c1cd6e70c124c7c2aebc133bf968eae53bbea2`
- Pre-reset: `e8c1a7d77f3546bb2f940f4e7b439ed06a273e83`
- Fixture SHA256: `c77b51bc731e4f236296675922846e4a1045701428e7839c1676f49974fc8ee2`
- Aggregate: `/workspace/Reference/benchmarks/m8-restart-stale/aggregate.json`
- Aggregate SHA256: `28f77822d55d9cf77a0bfc5146d4b99c387e1a52f574b921dbe76f791606bc90`

## Decision

**RETAIN restart reconciliation and stale-callback fencing.** Current refuses a same-session resume when the prior in-flight host run cannot be verified aborted, sends no duplicate prompt, preserves restart quarantine, and keeps the late callback non-acceptable.

Pre-reset sends a new prompt to the unverified old session, clears restart quarantine and re-enables callback acceptance. Mechanically observed: duplicate dispatch=1 and stale callback acceptance=1 versus zero for current.

No provider/model execution or monetary cost occurred.
