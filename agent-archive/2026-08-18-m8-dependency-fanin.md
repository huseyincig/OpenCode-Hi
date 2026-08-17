# M8 Dependency/Fan-In Scheduler Ablation

- Date: 2026-08-18
- Current Hi commit: `42c1cd6e70c124c7c2aebc133bf968eae53bbea2`
- Pre-reset baseline: `e8c1a7d77f3546bb2f940f4e7b439ed06a273e83`
- Host/model: OpenCode 1.18.18, `opencode-go/deepseek-v4-flash`, variant `low`
- Final fixture SHA256: `c2b2c6f70804f1003e0d9b354bdfa7bb2613a7001bac6e286c4c898c4946bdd5`
- Aggregate: `/workspace/Reference/benchmarks/m8-fanin/aggregate-r11-r13.json`
- Aggregate SHA256: `e82679dcea1975fbe3a64f5d859e53ffa3c8735dbbf857c917ef5ea7ff17edf4`

## Decision

**RETAIN dependency/fan-in scheduling.** Current Hi completed 3/3 final repetitions with exact durable A+B -> C dependency edges and C dispatch only after both prerequisites completed. Pre-reset Hi completed 0/3 and timed out in every final repetition.

Vanilla OpenCode completed external acceptance 3/3 and was materially more efficient, so this is not a Hi-over-vanilla superiority or efficiency claim. The retained value is deterministic runtime-owned dependency ordering and predictable completion semantics.

## Final means

- Current: 110.31s wall, 109.75k input, 25.0 model calls, 39.33 tools, 3 workers, peak 2, 11.75k child-context bytes, OpenCode-derived cost $0.031735, success 3/3.
- Pre-reset: 300.13s wall, 95.88k input, 21.33 model calls, 38.67 tools, mean 1.33 workers, OpenCode-derived cost $0.032176, success 0/3.
- Vanilla: 85.88s wall, 26.11k input, 8.33 model calls, 15.0 tools, OpenCode-derived cost $0.009565, success 3/3.

## Pilot exclusions / root causes

- r1 used semantic `sequential` and activated `hi-implementation-planning`, confounding scheduler isolation.
- The scheduler-only fixture pins mission semantic dependency class to `independent-multi`; task-contract edges remain authoritative.
- r8-r10 allowed model-selected workspace isolation. Current r9 selected isolation, workspace creation failed with an OpenCode transport `Unable to connect`, then parent retried without isolation. These runs are excluded.
- Final r11-r13 explicitly prohibit worktrees/workspace isolation and add fail-closed exact graph, timing and duplicate-worker-dispatch checks.

All monetary values above are OpenCode-derived, not provider-billed.
