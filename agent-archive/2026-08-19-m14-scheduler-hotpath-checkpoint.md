# M14 Checkpoint — Scheduler Hot-Path Preparation

**Date:** 2026-08-19
**Status:** RETAINED; M14 remains ACTIVE.
**Product commit:** `90805398287f86f9596abf16862ee49ced0262b3`

## Baseline characterization

Exact retained M13 image `e0cb30f82947a22f0bedec4c69a9da1cf4f0ee1b` was characterized before product mutation.

- runner: `/workspace/Reference/phase2-autopilot/run_m14_baseline_characterization.mjs`
- runner SHA-256: `e0bc226866914d4350001643c1bb2a7ee747932d8fa8e9ab6e537bd2e25b0ee5`
- receipt: `/workspace/Reference/phase2-autopilot/m14-baseline-characterization.json`
- receipt SHA-256: `459008da5b866166462f36ef22e377ea02fb1246584b21226c81deae612b2ead`

Findings:
- two 365-day-old exact-attempt model failures still produce the same `low` confidence and configured-prior rerank as fresh observations; age is not currently used;
- a coherent 365-day-old READY project-methodology candidate is still admitted; observation age is not currently used;
- scheduler admission showed material superlinear local CPU cost: the baseline 8-admission profile rose from low single-digit milliseconds on small graphs to roughly 100 ms at 128 units and roughly 400 ms at 256 units.

The 365-day probe is adversarial evidence of age-insensitivity, not a proposed decay horizon.

## Retained scheduler cutover

The scheduler now prepares graph-derived dependency/conflict decisions once per pure admission call and reuses them while only simulated `capacity.running` changes. The prepared planner is a call-scoped closure; it is not persisted and does not become another state/cache owner. Fairness lookup and selected-unit membership also use bounded maps/sets inside the same call.

Exact comparator:
- runner: `/workspace/Reference/phase2-autopilot/run_m14_scheduler_comparator_exact.mjs`
- runner SHA-256: `23d2037a083465bb9962d9bb677f5d0226283d945365cca0801eff027d403094`
- receipt: `/workspace/Reference/phase2-autopilot/m14-scheduler-comparator-exact.json`
- receipt SHA-256: `e1cd9a935adb23a61c8ff04fb14d8f162d0b57fb46e8f8a08195d05a84df3213`
- normalized decisions are identical for independent, mutable-conflict, fan-in, failed-dependency and larger independent fixtures;
- candidate is faster at every measured size;
- 128 units: `97.1031 ms -> 11.7242 ms` median (`-87.93%`, `8.282x`);
- 256 units: `391.0434 ms -> 44.1929 ms` median (`-88.70%`, `8.849x`).

These are deterministic local scheduler CPU measurements only; no model/provider/token/cost claim is made.

## Exact product verification

Immutable Git archive: `/workspace/Reference/phase2-autopilot/opencode-hi-90805398287f86f9596abf16862ee49ced0262b3`

- build PASS; log SHA-256 `f1d963ec4ae1a5f8d0bf0beabd20fdf4a2fd4f2093fb391f51461d41b5363e80`;
- architecture lint `22/22 PASS`; log SHA-256 `179c0c2342de88218e68c8cdff8978d1d633faa88b2cd9bc99c1f476e3d8f973`;
- plugin suite `1004/1004 PASS`; log SHA-256 `d95c56eaa80ba0741412f9ec311921084d0fc38919bafdd8b0f425b16104bf1b`;
- deterministic prepared-planner regression test is included in the product commit.

## Remaining M14 work

The next decision-quality cutover is model/procedure feedback decay/freshness. No canonical Hi TTL or half-life exists yet. Do not copy an external system's 30-day candidate-memory TTL into Hi by analogy. Define a deterministic, reversible admission rule from Hi ownership semantics, preserve explicit/fixed user model authority, preserve historical methodology provenance, and prove stale attribution stops affecting active decisions without deleting evidence. Scheduler/index work beyond this checkpoint requires another measured hot-path gap.
