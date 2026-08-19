# M14 Checkpoint — Material Semantic Epoch Feedback Decay

**Date:** 2026-08-19
**Status:** RETAINED; M14 remains ACTIVE.
**Product commit:** `d90787b06cf6f1fe64e0656b10403825bd4b5114`

## Decision boundary

M14 does not invent a wall-clock TTL for model or methodology learning. The project has no canonical Hi half-life/TTL, and external systems' time windows are not authority for this product.

Mission-local model feedback now loses active routing weight across an existing Hi semantic boundary that already means the implementation contract changed:

- `amendment` -> prior-generation feedback is historical only;
- `constraint` -> prior-generation feedback is historical only;
- `verification`, `non-material`, `stop`, and `resume` do not decay the same task/model feedback merely because the continuation generation changed;
- observations from workers with unknown legacy `generation_at_spawn` fail closed after a material boundary;
- historical workers/evidence are never deleted by this rule;
- two fresh same-epoch observations still satisfy the existing low-confidence admission threshold and may rerank configured priors;
- explicit/fixed model authority remains above empirical feedback.

A 365-day-old observation in the same unchanged semantic epoch deliberately remains eligible. Wall-clock age alone is not treated as semantic staleness.

## Project methodology boundary

No time-based de-admission was added to canonical project methodologies. `SKILL.md + policy + hash-bound provenance` are canonical project policy with explicit retirement/update semantics. A historical derived READY candidate is inert merely by being loaded; a new evidence-backed observation is required before an uncovered candidate emits `project.methodology-gap` again. This boundary is locked by the M14 freshness test.

## Mechanical comparator

- runner: `/workspace/Reference/phase2-autopilot/run_m14_feedback_epoch_comparator_exact.mjs`
- runner SHA-256: `0c627268c7994528b7e40b17c1e7d7ed1734a7f1292d1657b34efdedc017ec0b`
- receipt: `/workspace/Reference/phase2-autopilot/m14-feedback-epoch-comparator-exact.json`
- receipt SHA-256: `5d5b580ce63809f5f0ec1f73981ce8ff5aea8a58338c6b92521b56c6fe76b861`

All comparator claims PASS:
- same-epoch feedback unchanged;
- verification-only feedback unchanged;
- non-material + stop/resume lifecycle feedback unchanged;
- amendment decays prior active weight;
- constraint decays prior active weight;
- one fresh post-boundary sample stays insufficient;
- two fresh samples re-admit feedback;
- explicit model authority remains authoritative;
- unattributed legacy generation fails closed after material boundary;
- wall-clock age alone does not expire an unchanged epoch.

## Exact product verification

Immutable image: `/workspace/Reference/phase2-autopilot/opencode-hi-d90787b06cf6f1fe64e0656b10403825bd4b5114`

- build PASS; log SHA-256 `f1d963ec4ae1a5f8d0bf0beabd20fdf4a2fd4f2093fb391f51461d41b5363e80`;
- architecture lint `22/22 PASS`; log SHA-256 `179c0c2342de88218e68c8cdff8978d1d633faa88b2cd9bc99c1f476e3d8f973`;
- plugin suite `1010/1010 PASS`; log SHA-256 `e0d49b1ddd63429cce2078a067f75d2117f54423ab1f4ff24992480e09eedee9`.

## Remaining M14 work

Audit async wait/cancellation, queue/backpressure and memory-retention behavior on this exact checkpoint. Measure waiter/timer cleanup, cancelled/removed worker wake behavior, queued-work lifecycle, and any retained ephemeral maps after terminal/cancel paths. Change product code only for a mechanically demonstrated leak/liveness/fairness gap; otherwise retain the current runtime and close M14 from evidence rather than adding speculative state.
