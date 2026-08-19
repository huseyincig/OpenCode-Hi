# OpenCode-Hi Active Task State

**Project:** `/workspace/OpenCode-Hi`
**Status:** ACTIVE — PHASE 2 / MILESTONE 14
**Updated:** 2026-08-19
**Global authority:** `/workspace/PROTOCOL.md`
**Project policy:** `/workspace/OpenCode-Hi/PROTOCOL.md`
**Roadmap:** `/workspace/OpenCode-Hi/ROADMAP.md`

## Active Task

### M14 — Closed-Loop Supervision & Runtime Engineering

M13 is complete. Archive: `agent-archive/2026-08-19-m13-browser-autopilot.md`. M14 first retained product checkpoint is `90805398287f86f9596abf16862ee49ced0262b3`; exact immutable-image verification is build PASS, architecture lint `22/22 PASS`, plugin suite `1004/1004 PASS`. Scheduler checkpoint: `agent-archive/2026-08-19-m14-scheduler-hotpath-checkpoint.md`.

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

On exact retained M14 checkpoint `9080539`, design and test the smallest reversible decay/freshness admission rule for model feedback and project methodology learning. Baseline receipt `m14-baseline-characterization.json` proves 365-day-old observations still affect both routing and methodology admission, but no canonical Hi TTL/half-life exists. Preserve historical evidence/provenance and explicit/fixed user model authority; stale evidence should lose active decision weight rather than be destructively deleted. Do not copy an external memory TTL by analogy. Before retention, use adversarial fresh/stale/boundary attribution tests, a hash-bound baseline→candidate decision comparator, architecture lint and an exact immutable full suite.
