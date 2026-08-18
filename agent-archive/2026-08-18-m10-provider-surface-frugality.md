# M10 — Dynamic Provider-Visible Surface & Token Frugality

**Completed:** 2026-08-18
**Parent HEAD:** `d2f9ebf964a333756d086c1e208dc886de4bd006`

## Outcome

M10 retained the common semantic/frugality correctness fixes and **rejected** browser-unavailable primary schema gating. The candidate made the provider-visible tool schema smaller but made the repeated real production task materially more expensive overall.

## Retained product changes

- bounded semantic target/path normalization instead of treating free-form target prose as exact changed-file ownership;
- syntax-driven explicit user verifier extraction for low/medium local initial verification, preventing inferred broader checks from silently becoming required;
- DIRECT/EVIDENCE parent verifier admission blocks unrequired broader verification until changed-surface/risk/failure evidence expands the contract;
- read-only current Git status fallback reconciles reverted transient files without claiming pre-existing user changes as Hi-owned;
- ceremony-only root-cause obligations are removed for clear bounded bug fixes, while real ambiguity/debugging/high-risk diagnosis retains analysis ownership;
- bounded DIRECT implementation may close only from current owned diff plus fresh post-mutation required evidence, and completion is adjudicated in the same runtime transaction;
- terminal completion projection/guards prevent unnecessary verifier continuation and convert redundant direct-progress calls into an already-completed result rather than a recovery loop.

## Rejected ablation

Candidate: hide the eight primary browser schemas when observed browser support/executor is unavailable.

Static surface:
- common: `31` tools / `7839` proxy chars;
- candidate: `23` tools / `6451` proxy chars;
- schema proxy reduction: `17.71%`.

V12 real-host fixture: OpenCode ripgrep Unicode preview regression, exact `opencode-go/deepseek-v4-flash` comparator pin for M8 provenance. Both arms completed `3/3 VERIFIED_SUCCESS` with unchanged test and one production-file diff.

Candidate vs common mean deltas:
- wall `+10.26%`;
- model calls `+16.67%`;
- tool calls `+12.20%`;
- input tokens `+36.41%`;
- output tokens `+10.64%`;
- first-step input `-3.46%`;
- OpenCode-derived cost `+31.87%`.

Decision: **REJECT browser-unavailable primary schema gating**. A first-step/static-context reduction is insufficient when end-to-end execution regresses.

## Mechanical evidence

- aggregate: `/workspace/Reference/phase2-autopilot/m10-browser-realhost-v12-aggregate.json`
  - SHA-256 `d021e26dbdd650a0dbd373faf751619ee9a88f0d811ee2d05f5eb125f7ffced2`
- final retained manifest: `/workspace/Reference/phase2-autopilot/m10-v12-retained-final-manifest.json`
  - SHA-256 `da47dac4d827165dfce892a7e1030733ae969f4f422dc523567c13919ccc84fe`
- retained isolated image: `/workspace/Reference/phase2-autopilot/opencode-hi-m10-retained-v12-final`
- retained check log: `/workspace/Reference/phase2-autopilot/m10-v12-final-retained-check.log`
  - SHA-256 `e0272adeac774245e40aa6b9f6643630c9eb017a60648a56bd8617c7c0443404`
- build PASS;
- architecture lint `22/22 PASS`;
- isolated plugin suite `965/965 PASS`.

The clean retained corpus intentionally excludes the rejected candidate test `phase2-provider-surface.test.mjs` and pre-existing user-owned dirty tests. The previously observed 968-test working-tree overlay included two rejected-candidate tests plus one additional user-owned `hi-core-evolution` test; it is not the retained-product corpus.

All monetary figures are **OpenCode-derived cost**, not provider-billed cost.

## External/current model note for M11 handoff

On 2026-08-18 the seven user-selected OpenCode Go model IDs were present in `https://opencode.ai/zen/go/v1/models`. OpenCode Go documentation currently defines usage limits by dollar value and says request-count tables are estimates that can change. M11 therefore treats the user's explicit model/quota matrix as Hi planning/routing authority while keeping unobserved provider remaining quota `UNKNOWN`.

## Publication

No push, tag, release, npm publish or deployment was performed.
