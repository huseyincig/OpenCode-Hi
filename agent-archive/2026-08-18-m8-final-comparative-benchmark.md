# M8 Final Comparative Benchmark and Cutover Decision — 2026-08-18

## Scope and authority

Milestone 8 was completed under `/workspace/PROTOCOL.md` with `/workspace/Reference/upstream-audit/benchmark-plan.md` as the benchmark design. Unrelated dirty validation/release/script/source/test work was preserved. No push, tag, release, deploy, or npm publication was performed.

The exact retained product-code commit at final benchmark/verification is:

- `8f6b19098b1db0a739bb97f82537fcdc45896278` — `runtime: reconcile unbacked debugging signals`

Pre-reset comparative baseline remains:

- `e8c1a7d77f3546bb2f940f4e7b439ed06a273e83`

Host/runtime used for the final production batch:

- OpenCode `1.18.18`
- model `opencode-go/deepseek-v4-flash`
- variant `low`

Monetary values below are **OpenCode-derived**, not provider-billed.

## Production external-validity task

Final task:

- repository: `anomalyco/opencode`
- from: `ab7cbc808f61e062af20d9a9a838ae93ed8f940d`
- to: `6c035e1fd79ede42506eda9a04cab07cb1e502e7`
- target regression: Unicode-safe ripgrep preview truncation
- exact permitted candidate path: `packages/core/src/ripgrep.ts`
- target test: `packages/core/test/ripgrep.test.ts`, required unchanged
- fixture sha256: `3936f2a4d1353f09b0969cd84dae1795831a7e2548867e6333ffe5be5df69b79`
- runner sha256: `845e11ad0d88df298166db81b3587d79edf402bbd31d6088d2743e7c728a8075`
- aggregate: `/workspace/Reference/benchmarks/m8-production/aggregate-r8-r10.json`
- aggregate sha256: `3a1dbea06117e6ae9cc555ffe91dee749eb1a1ea345866f25f5bf6bb0dc47c7a`
- receipt validator: exact `/workspace/Reference/benchmarks/opencode-hi-42c1cd6/plugin/dist/contracts/comparative-benchmark.js`

The harness is fail-closed over full-repository `git status --porcelain=v1 --untracked-files=all`. Only OpenCode-generated `.opencode/package.json`, `.opencode/bun.lock`, `.opencode/node_modules/`, `.opencode/.gitignore`, and `.opencode/hi/` are ignored. Any other tracked/untracked candidate change fails bounded-diff acceptance. The target regression-test hash must remain unchanged.

### Final r8/r9/r10 results

**Current Hi `8f6b190`: 3/3 VERIFIED_SUCCESS and 3/3 strict Hi settlement.** All three repetitions passed external acceptance, changed only `packages/core/src/ripgrep.ts`, and left the target test unchanged.

Current means:

- wall: `103625 ms` (range `72734–121558`)
- model calls: `11.33` (range `9–14`)
- tool calls: `12.67` (range `10–15`)
- input: `114502` tokens (range `86386–137721`)
- output: `3133` tokens (range `1830–4903`)
- OpenCode-derived cost: `$0.029092308` (range `$0.022094416–$0.034654760`)

**Pre-reset Hi `e8c1a7d`: 0/3 VERIFIED_SUCCESS, but 3/3 external acceptance.** Every repetition made the correct one-file production change and kept the target test unchanged, but strict Hi settlement failed in every run. All three stopped with `o-analysis` still open; r8 also retained `hi-debugging-root-cause`, and r10 retained `hi-debugging-root-cause` plus `hi-regression-review`. This is a reproducible control-plane settlement failure rather than an implementation/test failure.

Baseline means:

- wall: `100292.33 ms`
- model calls: `13.33`
- tool calls: `14.67`
- input: `89558.67` tokens
- output: `5259.67` tokens
- OpenCode-derived cost: `$0.0249546853`

**Vanilla OpenCode: 3/3 VERIFIED_SUCCESS/external acceptance.** All three runs changed exactly `packages/core/src/ripgrep.ts` and left the test unchanged.

Vanilla means:

- wall: `42081.67 ms` (range `35129–54588`)
- model calls: `7.0` (range `5–10`)
- tool calls: `6.33` (range `4–9`)
- input: `15230.67` tokens (range `14426–16720`)
- output: `850.33` tokens (range `583–1168`)
- OpenCode-derived cost: `$0.0051614013` (range `$0.004437500–$0.006466940`)

Current therefore provides a strict settlement/correctness improvement over reproducible pre-reset Hi on this production task, but it is **not** an efficiency win over vanilla. Current used about `2.46x` vanilla wall time, `7.52x` input, `1.62x` model calls, `2.0x` tool calls, and `5.64x` OpenCode-derived cost. It is also not uniformly cheaper than pre-reset on this task: mean wall was `+3.3%`, input `+27.9%`, and OpenCode-derived cost `+16.6%`, while output was `-40.4%`, model calls `-15.0%`, and tool calls `-13.6%`. Correctness/predictability, not a global efficiency claim, justifies the current control-plane fixes.

Pilots r1/r2/r3 and the pre-coherence current r8 are retained only as debugging evidence and are excluded from the final r8/r9/r10 aggregate.

## Production-driven runtime fixes

The real production task exposed three control-plane defects before the final batch:

1. `bf20eaca6869a683d99cad69136f3d5075dc6ab0` — `runtime: reconcile direct bug-fix completion signals`
   - suppresses over-inferred debugging on clear bounded DIRECT bug-fixes while preserving uncertain real debugging;
   - makes `hi_direct_progress` return truthful remaining obligations, methodology needs, verification state, and completion readiness rather than implying completion prematurely.
2. `2da7d7a8094c375fe71e50ef183d066b4b03aba6` — `runtime: reject incoherent sequential bugfix semantics`
   - rejects the contradictory single-target `multi-file + sequential` low-risk bug-fix classification that had activated planning solely because a read-only regression test was part of verification;
   - preserves real multi-target sequential work and unresolved/ambiguous cases.
3. `8f6b19098b1db0a739bb97f82537fcdc45896278` — `runtime: reconcile unbacked debugging signals`
   - suppresses `intent.debugging` when a bounded bug-fix assessment does not also require diagnosis capability;
   - keeps debugging active when `repository-analysis` is materially required.

These were product fixes, not benchmark-settlement bypasses. Exact current archived plugin verification after the fixes is build/architecture-lint/full-suite PASS at `934/934` tests.

## Architecture ablations required by benchmark-plan.md

The five missing Architecture-ablation fields were mechanically searched in TASKS/archive first. Historical implementation tests existed for some mechanisms, but no final M8 comparative ablation receipts existed, so the missing comparisons were run once as a minimum deterministic **synthetic policy-ablation** fixture against exact retained `8f6b190` dist.

Aggregate:

- `/workspace/Reference/benchmarks/m8-architecture-ablations/aggregate.json`
- sha256 `53786945dd0fcba8cf2d396b06489e9761cae2d9cbf4a35d9f32592ab96de460`
- combined fixture wall `564 ms`
- no provider/model inference and no monetary cost claim
- claim boundary: structural/control-plane behavior and exact byte/provenance differences only; no natural-language efficiency or population-level defect-detection claim

All five `POLICY_ABLATION` receipts validate `true` under the exact comparative receipt contract:

- direct vs graph-planned topology: receipt sha256 `b754016f8bd98b85ad2705321ed56ffaaf17d836b104876edce3b1e8603cf6d0`
  - retained policy selects `DIRECT` for clear local independent work;
  - synthetic force-graph comparator adds at least one child dispatch and one context boundary.
- semantic no-progress governor: receipt sha256 `0be749c6ca64e0bbb1083e45773a56e132aa32d516938ced4b34cbd8e84c3f9c`
  - retained semantic governor: `0` false positives / `0` false negatives across the churn/recovery fixture and `2/2` recovery hits;
  - disabled naive state-change comparator: `2` false-progress positives while still recognizing the same recovery events.
- model empirical routing: receipt sha256 `070980dd874073da4c68e86fbef5a69f46a252ee21a89f1c88290193c5d0a24a`
  - same deterministic inventory selects heuristic `p/model-a` without feedback;
  - bounded medium-confidence empirical failures/successes change selection to `p/model-b`.
- skill shortlist: receipt sha256 `9d19276c8ed04d9e00d5a32d7600f9d13fed06ca96ee1404ac5df2b50e72a1da`
  - exact built-in catalog has `27` entries / `13777` metadata bytes / `36437` skill-body bytes;
  - two-methodology shortlist has `2` entries / `1013` metadata bytes / `2765` body bytes;
  - reduction: `92.65%` metadata and `92.41%` body bytes in this deterministic exposure fixture.
- fresh-context review: receipt sha256 `79127c8a9ba193be9fac3b581b9900634ca507b14891e7823c973bbb4116b2d5`
  - exact host child-creation seam for the retained default has no implementation-session fork source;
  - contaminated comparator explicitly forks `implementation-session`;
  - deterministic contamination oracle finds the seeded boundary defect only in the fresh comparator. This oracle is synthetic evidence of contamination risk, **not** a measured LLM defect-detection rate.

Decisions: retain adaptive direct execution, semantic no-progress governor, bounded empirical routing feedback, shortlist/lazy methodology exposure, and fresh reviewer session default. Explicit reviewer forking remains opt-in rather than default.

## Other M8 retain/reject decisions already established

- generic parallelism is **not** retained as an efficiency claim; independent parallel current was much heavier than vanilla;
- deterministic mutable-surface scheduler admission is retained for correctness/predictability;
- dependency/fan-in scheduler semantics are retained for deterministic ordering;
- claim-linked task/attempt evidence, scoped freshness/reopening, recovery ownership, stale-callback fencing, exact-action authority, bounded context selection, and coexistence/idempotent composition are retained on their mechanically demonstrated task classes;
- generic ProjectIntelligence injection remains removed;
- the broad primary tool-visibility cutover remains rejected/reverted because repeated end-to-end economics regressed despite a smaller provider-visible schema.

## Final verification

Exact isolated archive `/workspace/Reference/benchmarks/opencode-hi-8f6b190`:

- plugin `npm run check`: PASS;
- build: PASS;
- architecture lint: PASS;
- node/plugin suite: `934/934 PASS`;
- `plugin/dist/plugin.js` sha256 `66980d0546f69c9b32a045291fa9601289dcc31422ab8a6c493b94c702689bea`;
- `plugin/dist/contracts/comparative-benchmark.js` sha256 `0ede93af9fff359ac1f071c71a2abd19587c59f7a420d0bcf4a544e4d7cbc009`.

Two broader repository checks remain outside this milestone's permitted dirty/validation scope:

- `docs:check` fails because product-truth inventory still expects 8 owner files intentionally removed/thinned during prior reset scope-down (`skills/catalog-index`, old context governor, old ProjectIntelligence files, old browser runtime, etc.). This was mechanically reproduced before the final production fixes and is not repaired here because the user explicitly prohibited unrelated validation/docs work.
- `check:evidence` is not a valid clean final-certification signal from the git-archive environment because its historical/ancestry checks require Git history, and its committed validation records also contain widespread pre-existing hash drift/missing removed-owner references. No validation/release/script files were rewritten to manufacture a green result.

The required retained-product verification for M8—exact build, architecture lint, full plugin suite, benchmark receipt validation, scoped diff inspection—passes.

## Final state

Milestone 8 and the architecture reset roadmap are complete. ROADMAP defines no subsequent numbered milestone. The repository should remain idle for a new explicitly authorized objective; deferred publication/release work is not activated automatically.
