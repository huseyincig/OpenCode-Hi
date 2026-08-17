# Milestone 5 — Semantic Progress, Recovery + Economics

**Completed:** 2026-08-17
**Checkpoint:** commit containing this record (`architecture: govern semantic progress and recovery economics`)

## Result

- Replaced raw state-change stagnation reset with a host-neutral semantic progress snapshot/delta.
- Positive progress now requires evidence gain, dependency/task/obligation/process advancement, changed surface, or a new failure signature. Status churn and evidence invalidation alone are not positive progress.
- Repeated identical failure/signature does not repeatedly reset stagnation; new diagnostic information counts once.
- Added bounded recovery strategy history and same-semantic-state replay prevention. A repeated strategy is skipped unless semantic state changed; the governor advances to a materially different recovery rung or user action.
- Automatic recovery fails closed while a consequential external action has an unknown/unreconciled outcome.
- Added exact-attempt-bound worker usage observations. Duplicate assistant-message observations are deduplicated deterministically.
- OpenCode `step-finish` token observations are aggregated as complete exact execution token usage. Assistant-message token fallback remains exact as a reported observation but is explicitly partial/coverage-limited.
- OpenCode monetary `cost` is labeled `opencode-calculated / derived`; it is never represented as provider-billed exact spend without a distinct provider-billed source.
- Smart Select `expected_completion_cost` is explicitly labeled `heuristic` and remains a routing score input, not usage telemetry.
- Added a budget coverage view over existing hard limits (continuation turns, semantic recovery rungs, topology concurrency, execution-profile context/handoff/result/artifact caps, process timeout) and observed-only axes for exact token usage / monetary observations when no hard limit exists.
- Model feedback now uses exact-attempt canonical evidence, attributes fallback failure/retry to the failed `from` model, and does not let retry count manufacture confidence. Confidence remains current-mission and bounded-window rather than permanent reputation.
- Added a deterministic recovery ablation proving same-state redundant strategy replay drops from 1 to 0 while the fresh-state first recovery action remains unchanged.

## Current OpenCode / models.dev source basis

Verified on 2026-08-17 against current primary upstream and this repository's installed SDK dependency:

- `anomalyco/opencode` dev `packages/opencode/src/session/session.ts`: assistant/session usage contains input/output/reasoning/cache tokens; `getUsage()` derives most monetary cost from model pricing and normalized provider usage, with provider-specific direct billing data only on explicitly handled paths such as Copilot `totalNanoAiu`.
- `anomalyco/opencode` dev `packages/opencode/src/session/processor.ts`: `step-finish` parts carry per-step tokens/cost; assistant `cost` accumulates while assistant `tokens` is replaced with the current step usage. Hi therefore uses step-finish parts for complete attempt token aggregation when present.
- `anomalyco/models.dev`: provider cost fields are USD per million tokens and are model/provider pricing metadata, not proof of the actual provider invoice.
- Project-local `@opencode-ai/sdk` version is `1.18.18`; its v1/v2 `AssistantMessage` and `StepFinishPart` declarations contain the same core token/cost shape used by the adapter.
- The previously used isolated OpenCode executable path under `/home/node/.local/share/hi-opencode-1.18.18/...` was not present during this milestone, so no live CLI binary claim is made from that old path.

Primary references:
- https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/session/session.ts
- https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/session/processor.ts
- https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/session/message.ts
- https://github.com/anomalyco/models.dev

## Verification

- recovery/progress/provider/authority/persistence focused set: **60/60 PASS**
- usage/economics focused set: **27/27 PASS**
- model-feedback focused set after final attribution fixes: **22/22 PASS**
- budget/recovery/progress focused set: **24/24 PASS**
- deterministic recovery ablation/regression set: **17/17 PASS**
- full plugin suite: **916/916 PASS**, 0 fail, 0 cancelled
- architecture lint: **22/22 PASS**
- TypeScript build: PASS
- scoped `git diff --check`: PASS

## Important boundaries

- No fabricated provider-billed cost or token telemetry.
- No new arbitrary USD/token hard limits were invented. A value being measurable does not imply a configured budget or authority to enforce one.
- Mission wall time is observable but has no new arbitrary mission deadline; process-specific configured timeout remains a hard limit.
- Recovery strategy history is bounded to 24 records; automatic strategy rungs are bounded to five before user action on unchanged semantic state.
