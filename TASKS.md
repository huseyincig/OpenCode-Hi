# OpenCode-Hi Active Task State

**Project:** `/workspace/OpenCode-Hi`
**Status:** ACTIVE — PHASE 2 / MILESTONE 14
**Updated:** 2026-08-19
**Global authority:** `/workspace/PROTOCOL.md`
**Project policy:** `/workspace/OpenCode-Hi/PROTOCOL.md`
**Roadmap:** `/workspace/OpenCode-Hi/ROADMAP.md`

## Active Task

### M14 — Closed-Loop Supervision & Runtime Engineering

M13 is complete. Archive: `agent-archive/2026-08-19-m13-browser-autopilot.md`. Final retained M13 product commit is `e0cb30f82947a22f0bedec4c69a9da1cf4f0ee1b`; exact immutable-image build/architecture/plugin verification is `1003/1003 PASS` with architecture lint `22/22 PASS`.

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

On exact retained M13 commit `e0cb30f`, characterize the current closed-loop feedback and runtime hot paths without changing product behavior: routing/model feedback admission and decay, methodology/procedure learning, scheduler/registry state scans, async wait/cancellation, and mission/task retention. Build a bounded profiling/ownership matrix, then select at most one first cutover from a mechanically demonstrated decision-quality or runtime-efficiency gap. Do not add speculative indexes or a second learning/state runtime.
