# M15 Checkpoint — TDD Signal / Test-Mutation Authority Reconciliation

**Date:** 2026-08-19
**Status:** RETAINED; M15 remains ACTIVE.
**New final Phase 2 product commit:** `e0f7d9118bfe729e35520ec01c5ac8ac41e424c8`
**Prior product checkpoint:** `96267ce857eec53ae31d8549cd52c5eff7d88bf9`

## Corpus-discovered defect

The M15 localized production corpus on the exact retained `96267ce` product produced two materially different strict-settlement outcomes on the same real OpenCode Unicode/ripgrep regression, same OpenCode `1.18.18`, same `opencode-go/deepseek-v4-flash` model and `low` variant:

- r1: `VERIFIED_SUCCESS`; strict Hi settlement completed.
- r2: external implementation correctness PASS, targeted regression test PASS, bounded production-only diff PASS, both receipt validators PASS, but strict Hi result `VERIFIED_FAILURE` because the mission stopped with an open verification obligation and `hi-test-driven-development` methodology need.

The r2 semantic assessor emitted `intent.tdd` despite the exact user task saying `Do not modify tests or unrelated files.` The semantic gate already says `intent.tdd=test-first; test command=verification`; the runtime previously accepted the contradictory model-derived signal without reconciling it against explicit user authority.

The old r1/r2 receipts are immutable issue-discovery corpus and are not rewritten as final-product results.

## Retained correction

The runtime now reconciles only an explicit authority conflict:

- if raw initial/follow-up user text explicitly forbids test mutation (`do not/don't/must not modify/edit/change/write/add/create/update/touch tests`, equivalent unchanged-test wording, or `without modifying...tests`), `intent.tdd` is runtime-suppressed;
- raw model signal remains in ledger provenance;
- test paths remain available as verification/context targets;
- targeted verification remains unchanged;
- an explicit genuine TDD/test-first request remains active;
- a follow-up no-test-mutation constraint removes an already active TDD methodology need.

This is not a general keyword-based task classifier. Natural-language semantic assessment remains model-owned; the deterministic layer only enforces a direct explicit user authority contradiction.

## Mechanical comparator

Exact baseline → retained comparator:

- runner: `/workspace/Reference/phase2-autopilot/run_m15_tdd_authority_comparator_exact.mjs`
- runner SHA-256: `441f401dc2551d5e1466c8a98e9db24044ace0c51cb6ba1fcf2394da981f9d8e`
- receipt: `/workspace/Reference/phase2-autopilot/m15-tdd-authority-comparator-exact.json`
- receipt SHA-256: `ed063ead0d0bb0325e0fa6128bc3fe608a356a60706d81bbd8a78a7e3224b871`

Claims all PASS:
- baseline reproduces false TDD activation from the exact r2 assessment;
- retained candidate suppresses only the explicit authority conflict;
- verification targets/policy are preserved;
- genuine TDD behavior is preserved;
- raw model signal remains observable for provenance.

## Exact product verification

Immutable Git image:
`/workspace/Reference/phase2-autopilot/opencode-hi-e0f7d9118bfe729e35520ec01c5ac8ac41e424c8`

- build PASS — SHA-256 `f1d963ec4ae1a5f8d0bf0beabd20fdf4a2fd4f2093fb391f51461d41b5363e80`;
- architecture lint `22/22 PASS` — SHA-256 `179c0c2342de88218e68c8cdff8978d1d633faa88b2cd9bc99c1f476e3d8f973`;
- focused authority regression `5/5 PASS` — SHA-256 `c7cdb70345004804a9dff282dff4e0242207014bcadb3b7921e2a434040f5f25`;
- full plugin suite `1020/1020 PASS` — SHA-256 `4ccf16118465a1b454d629ce81ce5367d4908b09dd000f09bfad438b23163c28`.

## M15 next evidence rule

Because product identity changed, `96267ce` model-driven production r1/r2 cannot be promoted to the final Phase 2 corpus. The exact production fixture is being rerun only for the new final Phase 2 arm `e0f7d91`; existing vanilla and retained Phase 1 3x evidence remains reusable and is not rerun. After that, execute the already-prepared combined diagnosis/context triad against the current final product, then decide whether the remaining multi-module/fan-in broad gap needs a minimal replay.
