# Milestone 14 — Closed-Loop Supervision & Runtime Engineering

**Completed:** 2026-08-19
**Final retained product commit:** `96267ce857eec53ae31d8549cd52c5eff7d88bf9`
**Status:** COMPLETE

## Outcome

M14 retained three bounded changes from measured defects and deliberately did not add a second learning/runtime state owner.

1. **Scheduler hot-path preparation** — commit `90805398287f86f9596abf16862ee49ced0262b3`. A call-scoped pure prepared planner reuses invariant graph/dependency/conflict decisions while only simulated running capacity changes. No durable cache/index was added.
2. **Material semantic epoch model-feedback decay** — commit `d90787b06cf6f1fe64e0656b10403825bd4b5114`. Mission-local feedback loses active rerank weight across `amendment`/`constraint` boundaries, while verification/non-material/stop/resume control events preserve same-task feedback. Historical evidence is retained and fresh same-epoch observations may re-admit reranking. No arbitrary wall-clock TTL was invented.
3. **Bounded queue rejection transactionality** — commit `96267ce857eec53ae31d8549cd52c5eff7d88bf9`. Queue overflow no longer leaves created task/worker or deferred methodology/context bindings behind. Isolated workspace cleanup is exact-owner bounded: successful cleanup removes rejected ownership; cleanup failure remains durable BLOCKED + ORPHANED/QUARANTINED rather than being erased.

Canonical project methodologies remain explicit hash-bound project policy. Historical derived READY candidates are inert without a fresh observation, but canonical policy is not silently wall-clock expired.

## Baseline characterization

Baseline runner:
`/workspace/Reference/phase2-autopilot/run_m14_baseline_characterization.mjs`

- runner SHA-256: `e0bc226866914d4350001643c1bb2a7ee747932d8fa8e9ab6e537bd2e25b0ee5`
- receipt SHA-256: `459008da5b866166462f36ef22e377ea02fb1246584b21226c81deae612b2ead`

It mechanically exposed both age-insensitive feedback and material scheduler scaling cost before product mutation. The adversarial 365-day observation age was evidence of a missing semantic freshness dimension, not a proposed TTL.

## Scheduler evidence

Exact comparator:
`/workspace/Reference/phase2-autopilot/run_m14_scheduler_comparator_exact.mjs`

- runner SHA-256: `23d2037a083465bb9962d9bb677f5d0226283d945365cca0801eff027d403094`
- receipt SHA-256: `e1cd9a935adb23a61c8ff04fb14d8f162d0b57fb46e8f8a08195d05a84df3213`
- normalized behavior equal across independent/conflict/fan-in/failed-dependency fixtures;
- 128-unit 8-admission median: `97.1031 ms -> 11.7242 ms` (`-87.93%`, `8.282x`);
- 256-unit 8-admission median: `391.0434 ms -> 44.1929 ms` (`-88.70%`, `8.849x`).

These are local deterministic scheduler CPU measurements, not provider/model/token/cost claims.

## Feedback freshness evidence

Exact comparator:
`/workspace/Reference/phase2-autopilot/run_m14_feedback_epoch_comparator_exact.mjs`

- runner SHA-256: `0c627268c7994528b7e40b17c1e7d7ed1734a7f1292d1657b34efdedc017ec0b`
- receipt SHA-256: `5d5b580ce63809f5f0ec1f73981ce8ff5aea8a58338c6b92521b56c6fe76b861`

All ten decision claims PASS: same epoch/control-only behavior preserved; amendment/constraint decay old active weight; one fresh sample remains insufficient; two fresh samples re-admit existing low-confidence routing feedback; explicit model authority remains above empirical feedback; unattributed legacy generation fails closed after a material boundary; wall-clock age alone does not expire an unchanged semantic epoch.

## Liveness, backpressure & retained-state audit

Canonical topology (`parallelism=8`) baseline receipt:
- runner SHA-256: `910aece582ba55839f1adf57522a1122128f399a3c775b95f8fb8feefce3e5a6`
- receipt SHA-256: `70f4c5a4c51682e71419f03916b4b9184ed019ded8f2b57b8513d5f1c8dcfecb`

Negative evidence on exact `d90787b` baseline:
- 200 waiter `set` wakeups: all true, no active timer retained;
- 200 waiter `delete` wakeups: all true, no active timer retained;
- 100 timeout waits: all false, no active timer retained;
- absent-worker wait allocates no timer;
- delete/replacement race settles once and preserves the replacement;
- 100 concurrent same-fingerprint registry spawns invoke one spawn; resolved and rejected dedupe entries are reusable;
- queued cancel removes the exact queue/registry entry;
- cancelAll reduces queue/scheduler/registry/nonterminal worker counts to zero.

The real baseline defect was bounded queue overflow: the 33rd waiting task was rejected but left one `created` task + one `created` worker in mission state.

Final exact comparator:
`/workspace/Reference/phase2-autopilot/run_m14_backpressure_comparator_exact.mjs`

- runner SHA-256: `86b6dfd696e30e04621928d77634035c3b52f7aa1ce28e95183577bf0a4d051e`
- receipt SHA-256: `c036d5de206954ce61deacbb01c2208900a8bb24a003495c06fff2eaf5e39e4f`
- exact final liveness candidate receipt SHA-256: `c3dc03f2f3bb4c441a41c286bf8271b36c61194bc9c2d81580d8368abce9c373`
- baseline overflow: task `+1`, worker `+1`, one task orphan, one worker orphan;
- retained candidate: task `+0`, worker `+0`, no orphan;
- waiter/timer, dedupe, queued cancel, cancelAll and bounded rejection claims remain PASS in both arms;
- M14 rollback regression: `5/5 PASS`.

## Final exact verification

Immutable Git image:
`/workspace/Reference/phase2-autopilot/opencode-hi-96267ce857eec53ae31d8549cd52c5eff7d88bf9`

- build PASS — SHA-256 `f1d963ec4ae1a5f8d0bf0beabd20fdf4a2fd4f2093fb391f51461d41b5363e80`;
- architecture lint `22/22 PASS` — SHA-256 `179c0c2342de88218e68c8cdff8978d1d633faa88b2cd9bc99c1f476e3d8f973`;
- M14 backpressure regression `5/5 PASS` — SHA-256 `6303c1b293e213d3a4a37558e5d90931916e9aa33f2a95241d4cfd8b2073e67e`;
- full plugin suite `1015/1015 PASS` — SHA-256 `9a0df3acbba4d088050c1df6842d2e13d7957abfdb237b0750c56c008eb4cb53`.

## M14 acceptance verdict

- bounded confidence/decay/attribution: **PASS**;
- scan/index work only after profiling: **PASS**; only call-scoped prepared data retained;
- measurable scheduler/backpressure value: **PASS**;
- async cancellation/liveness and memory-retention audit: **PASS**, with one discovered queue orphan repaired;
- Big-O/allocation/hot-path claims mechanically bounded: **PASS**;
- second durable state owner introduced: **NO**.

M14 is complete. M15 must now decide broader product value from a comparable production corpus. Existing exact receipts should be inventoried and reused where provenance/model/system identity is comparable; do not rerun expensive episodes merely to recreate evidence already present.
