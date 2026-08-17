# M8 Mutable-Surface Conflict Benchmark

**Completed:** 2026-08-18  
**Current implementation commit:** `42c1cd6e70c124c7c2aebc133bf968eae53bbea2`  
**Pre-reset baseline:** `e8c1a7d77f3546bb2f940f4e7b439ed06a273e83`  
**Host/model:** OpenCode 1.18.18, `opencode-go/deepseek-v4-flash`, variant `low`

## Root cause and fix

The first conflict pilot exposed a concrete scheduler-admission seam defect. A model supplied multiple task scope paths as a semicolon-separated scalar (`src/alpha.js;src/shared.js`). The runtime only canonicalized comma-separated scalar lists, so the semicolon form became one literal path. The scheduler therefore could not see the shared mutable `src/shared.js` overlap, and diff-cleanliness also treated valid worker changes as outside declared scope.

Commit `42c1cd6e70c124c7c2aebc133bf968eae53bbea2` accepts exact semicolon-separated multi-path scope strings for compatibility while retaining fail-closed handling for ambiguous prose. Targeted scheduler/write-conflict/tool-surface verification passed 19/19. The exact archived commit at `/workspace/Reference/benchmarks/opencode-hi-42c1cd6` passed `npm run check` with 926/926 tests.

## Final fixture

The final r8-r10 comparison is intentionally a synthetic scheduler stress/ablation with pinned semantic classification. It is not evidence about natural-language semantic classification or natural-routing efficiency. Pilots r1-r7 are excluded from final economics/correctness comparison because they were invalid, methodology-confounded, or had incomplete queued-child economics before the collector correction.

- task: `m8-mutable-shared-work-003`
- fixture sha256: `19f6c7dd7a016f9e1aae14ecaf8229fdde664135575a94a19421530d2b8f3525`
- aggregate: `/workspace/Reference/benchmarks/m8-conflict/aggregate-r8-r10.json`
- aggregate sha256: `82cc1fc201971a0a861a1c1b4801ea36b724017d13b64d50334c42afcf1fc944`

## Results

Current Hi: 3/3 VERIFIED_SUCCESS. Each repetition contained two dependency-free task contracts with canonical scopes overlapping on `src/shared.js`; workers spawned=2 and peak concurrency=1 in all three repetitions. Mean wall 123.70s, input 104.29k, model calls 21.0, tool calls 39.67, child context 8.67k bytes, OpenCode-derived cost $0.030480.

Pre-reset Hi: 0/3. Every repetition timed out at roughly 300s and failed deterministic acceptance after only alpha/shared work landed; beta work did not complete. Mean wall 300.12s, input 127.78k, model calls 36.0, tool calls 58.67, OpenCode-derived cost $0.045471.

Vanilla OpenCode: 3/3 VERIFIED_SUCCESS with the exact expected three-file diff and unchanged tests. Mean wall 71.51s, input 27.61k, model calls 8.67, tool calls 16.0, OpenCode-derived cost $0.009210. Native `task` tool calls were observed, but no child-session telemetry was exported, so the receipts do not establish equivalent runtime-owned mutable-surface admission semantics.

All monetary values above are OpenCode-derived, not provider-billed cost.

## Decision

**RETAIN deterministic mutable-surface conflict admission.** It fixes a reproducible pre-reset correctness/predictability failure and mechanically serializes overlapping work. This fixture does not establish an efficiency advantage over vanilla: current was about 1.73x slower and 3.31x higher OpenCode-derived cost. The next scheduler discriminator is explicit dependency/fan-in dispatch and recovery.
