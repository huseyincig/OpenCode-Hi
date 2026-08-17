# M8 Primary Tool-Surface Ablation — Rejected Cutover

Date: 2026-08-17

## Candidate

Checkpoint `3dcf25dfe1c8dd3fd57163c5aed5a94d909ccefa` used OpenCode 1.18.18 built-in agent `tools:false` leaves to hide 13 provider-irrelevant Hi tools from the built-in primary catalog while preserving delegation/process/context/rollback controls and explicit host choices.

## Mechanical host finding

An isolated exact-host ablation proved that OpenCode 1.18.18 removes `tools:false` schemas from the provider-visible catalog. The original current first step was 10867–10871 input tokens; a 29-Hi-tool-off ablation produced 8404. This is retained as host-capability evidence only.

## End-to-end repeated result

Same fixture/model/variant/acceptance, 3 repetitions each. All pre- and post-cutover episodes were VERIFIED_SUCCESS with tests unchanged and diff limited to `src/calc.js`.

Pre-cutover current means: 49.653s wall, 41,771 input, 977 output, 8.67 model calls, 10.67 tool calls, OpenCode-derived cost $0.0103683.

Post-cutover means: 54.822s wall, 43,047 input, 1,132 output, 9.67 model calls, 11.33 tool calls, OpenCode-derived cost $0.0108428.

Post vs pre: wall +10.4%, input +3.1%, output +15.9%, model calls +11.5%, tool calls +6.3%, OpenCode-derived cost +4.6%. Rep 1 improved; reps 2 and 3 regressed. n=3 is not a general statistical claim, but it fails the milestone retention rule requiring repeated useful execution reduction.

## Decision

**REJECT / REVERT.** Provider-catalog narrowing is real, but this static built-in-primary cutover did not demonstrate end-to-end benefit. Do not retain architecture solely because first-step token count is lower.

Revert verification: build PASS; plugin suite 903/903 PASS; architecture lint 22/22 PASS. Raw receipts remain under `/workspace/Reference/benchmarks/m8-pilot/`. OpenCode monetary values are derived, not provider-billed.
