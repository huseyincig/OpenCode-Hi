# OpenCode-Hi Active Task State

**Project:** `/workspace/OpenCode-Hi`
**Status:** ACTIVE — PHASE 2 / MILESTONE 14
**Updated:** 2026-08-19
**Global authority:** `/workspace/PROTOCOL.md`
**Project policy:** `/workspace/OpenCode-Hi/PROTOCOL.md`
**Roadmap:** `/workspace/OpenCode-Hi/ROADMAP.md`

## Active Task

### M14 — Closed-Loop Supervision & Runtime Engineering

M13 is complete. Archive: `agent-archive/2026-08-19-m13-browser-autopilot.md`. M14 retained product checkpoint is `d90787b06cf6f1fe64e0656b10403825bd4b5114`; exact immutable-image verification is build PASS, architecture lint `22/22 PASS`, plugin suite `1010/1010 PASS`. Scheduler checkpoint: `agent-archive/2026-08-19-m14-scheduler-hotpath-checkpoint.md`; feedback-decay checkpoint: `agent-archive/2026-08-19-m14-feedback-epoch-checkpoint.md`.

M14 must improve decision quality from bounded attributed observations and harden runtime efficiency only where measurement proves value. It must not create a second state owner, broad self-modifying policy, speculative cache/index layer, or optimization without a baseline.

## M14 Acceptance

- routing/procedure learning uses bounded confidence, decay and attribution with reversible admission;
- repeated broad state scans are replaced by bounded indexes only where profiling identifies a material hot path;
- queue/fairness/backpressure/critical-path changes are retained only from measurable scheduler/runtime benefit;
- cancellation/liveness and memory-retention behavior remains bounded under adversarial lifecycle cases;
- Big-O/allocation claims are backed by actual profiling or bounded mechanical counters;
- retained changes improve measured hot paths or decision quality without introducing another durable state owner.

## Required Verification

- characterize existing routing/model/methodology feedback, scheduler/registry scans, async wait/cancellation and retained-state ownership before changing behavior;
- use current upstream/runtime research where OpenCode lifecycle or host semantics materially affect a decision;
- profile first, then change the smallest proven hot path or decision-quality defect;
- use adversarial/failure tests for lifecycle, decay, stale attribution and state-owner boundaries;
- use repeated hash-bound comparator for any learned-policy, scheduler or hot-path cutover;
- architecture lint + exact isolated full plugin suite for retained product-code changes;
- preserve unrelated dirty validation/release/script/routing/test files.

## Exact Next Action

On exact retained M14 checkpoint `d90787b`, audit async wait/cancellation, queue/backpressure and memory-retention behavior without product mutation first. Measure BackgroundRegistry waiter/timer cleanup, delete/cancel wake semantics, spawn-dedupe cleanup, TaskRuntime queue terminal/cancel removal, and any ephemeral map entries retained after adversarial lifecycle paths. Use bounded deterministic counters and active-handle checks where reliable; do not infer a leak from source scans alone. If a real leak/liveness/fairness gap is demonstrated, make one smallest cutover with an adversarial comparator. Otherwise preserve the current runtime and use the negative evidence toward M14 completion.
