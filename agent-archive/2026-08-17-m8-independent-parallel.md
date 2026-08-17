# M8 Independent Same-Model Parallel Fixture

**Completed:** 2026-08-17  
**Scenario:** `m8-independent-shared-work-002`  
**Artifacts:** `/workspace/Reference/benchmarks/m8-parallel/independent-shared-work-r8/` through `r10/`; aggregate `/workspace/Reference/benchmarks/m8-parallel/aggregate-r8-r10.json`  
**Aggregate SHA256:** `58c652b34f7e5f5e508c7b7e8dd488e6f244a7e9accb519043ef7de56f2bc9e4`

## Systems

- current Hi: `deb39dc7ec9396362e31a26008373dd3a7915eba`
- pre-reset Hi: `e8c1a7d77f3546bb2f940f4e7b439ed06a273e83`
- vanilla: OpenCode `1.18.18 --pure`
- model: `opencode-go/deepseek-v4-flash`, variant `low`
- fixture SHA256: `1c1410b786d7b38d52657b6ba5ef6329f185837c88882fd8114bc2915a03931b`

## Mechanical result

- Current: 3/3 VERIFIED_SUCCESS; 2 child workers and peak concurrency 2 each run. Means: 90.08s wall, 89.20k input, 20.67 model calls, 29.67 tool calls, 8.41k child-context bytes, $0.026624 OpenCode-derived cost.
- Vanilla: 3/3 VERIFIED_SUCCESS. Means: 21.05s wall, 14.06k input, 5.33 model calls, 10.33 tool calls, $0.003856 OpenCode-derived cost.
- Pre-reset Hi: 0/3 VERIFIED_SUCCESS under strict Hi settlement, although external targeted tests and bounded diffs passed. It spawned no child tasks and stopped with `o-analysis` and methodology needs unresolved.
- Current versus vanilla on this fixture: ~4.28x wall, ~6.35x input, ~3.88x model calls, ~6.91x OpenCode-derived cost. OpenCode cost is derived, not provider-billed.

## Harness correction

The runner originally treated a Hi episode with no task status as settlement-success even if the mission itself was stopped/unresolved. It was corrected fail-closed: no-task Hi settlement now requires mission `completed` plus no blockers/open obligations/methodology needs. Preserved r8 baseline artifacts were recomputed under this rule. Current r8-r10 already had explicit completed task settlement and were unaffected.

## Decision

The reset current control plane materially improves correctness versus pre-reset Hi for this scenario, but this fixture does not isolate that gain to WorkGraph/scheduler. It also does not show an end-to-end efficiency advantage over vanilla; parallel fan-out is not itself a success metric. Scheduler retention therefore remains provisional. The next discriminator is a real-host mutable-surface-conflict fixture where conflict detection/quarantine/serialization can demonstrate correctness or predictability value.
