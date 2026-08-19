# M11 — Adaptive Decomposition, Model & Review Intelligence

**Completed:** 2026-08-19
**Project:** `/workspace/OpenCode-Hi`
**Final product commit for M11:** `1bf47ac4a51f5e30e30ca9269821e369fac9f332`

## Outcome

M11 is complete. OpenCode-Hi now uses the user-authoritative OpenCode Go role priors as bounded defaults, allows confidence-admitted mission-local empirical feedback to rerank only within allowed role candidates, keeps explicit/fixed model authority above empirical feedback, and applies minimum-sufficient decomposition/review rules rather than agent ceremony.

## Retained product changes

- `d0ae80605609dd9f204e9e8df21d1f9c123a4052` — canonical in-memory Go role priors + confidence-aware empirical rerank within configured/default role sets; no silent routing-policy persistence.
- `41714b3824434383b7e9404526f9599f09e4a552` — non-material semantic assessment now persists a normalized assessed intent instead of producing an invalid assessed/unclassified mission state.
- `e0797bc1f062e0765d19c711e838bbc115dc15d2` — worker handoff requires canonical required evidence IDs as exact `evidence.kind` values; runtime evidence acceptance was not weakened.
- `1bf47ac4a51f5e30e30ca9269821e369fac9f332` — completion-ready missions reject redundant new/resume task starts before TaskRuntime dispatch.

## Model routing evidence

- Default-role attribution: repository-explorer→MiMo-V2.5, architect→Qwen3.7 Plus, qa-reviewer→Hy3, security-reviewer→MiMo-V2.5-Pro; SHA-256 `a62f2228d412de539ebbc00f7c1565c3da3d9585405732a66f7cbd798b8126dd`.
- Role-compatible alternates: architect→MiniMax M2.7 and qa-reviewer→Qwen3.6 Plus; SHA-256 `9c8fda1dbdd6e903ffad706abfd72d0826d84ce945ec11b2481d441ed8fa22e6`.
- Real-host empirical rerank: one sparse sample does not move the prior; two admitted same-role/category MiMo successes rerank the implicit coder choice within the allowed candidate set; SHA-256 `05a2b01e111c3e1f5374c7a579f44a8cec3b3dee081fd3307bb034b216b5dde6`.
- Resolution fallback + deterministic provider recovery/level-2 escalation evidence: SHA-256 `0dcdf828217b58702883a34495e5730b334f4f513ada47b7f13bbc1b2b757f15`. Authentic localhost provider-failure probes did not settle within the bounded 20-second probe ceiling, so no real-host runtime-provider-recovery success claim is made.
- Repeated trivial coder routing comparison: M11 candidate strict `3/3` vs legacy `2/3`; candidate retained for correctness/predictability, not generic cost advantage. Aggregate SHA-256 `4c72018e3cd07c15d1c1ca4e33a0de6b66c69a0a3ccd95f8f398ef8b04ad534b`.

## Decomposition evidence

- Clear bounded local work: DIRECT zero-child `3/3` vs one-child `3/3`; one child increased mean wall `50.50%`, model calls `72.22%`, tool calls `56.25%`, input `123.59%`, and OpenCode-derived cost `119.94%`. Retain zero-child default. Aggregate SHA-256 `f159e2b0a2c3d6f92731dc22dc545c27edd0c847d82a9b0ead84bb66929060c5`.
- Independent two-stream micro work: one-child strict `3/3`, two-child parallel strict `2/3` with external acceptance `3/3`; fan-out increased mean wall `21.76%`, input `39.26%`, and OpenCode-derived cost `38.86%`. Do not prefer generic micro fan-out. Aggregate SHA-256 `f3942cc7fd0961c063d7eb155ef6161300ff21ac6bf312e71e4e7ecda880378a`.
- Dependency/fan-in micro work: one-child and A+B→C fan-in were both strict `2/3`, external acceptance `3/3`; fan-in increased mean wall `67.97%`, input `103.80%`, child context `155.96%`, and OpenCode-derived cost `105.61%`. Dependency guards correctly failed closed when a prerequisite result failed. Retain fan-in scheduler capability for materially required work graphs, not as a micro-task default. Aggregate SHA-256 `cda3320b37d8d0f076b367612f64e6b8a3f5aa0c313bd541098343e8ae9de1b2`.
- Current product scheduler/dependency/conflict focused gate: `27/27 PASS`; log SHA-256 `e0c33edd71d4dff0582468173acc4ae0a3cb0fa04c15d2965eba38f1d0c159b9`.

## Reviewer evidence

Low-risk direct review and high-assurance fresh review were compared on the same read-only security invariant.

- Low-risk direct: `3/3` strict success, zero child.
- High-assurance: `3/3` strict success, exactly one fresh `opencode-go/mimo-v2.5-pro` security-reviewer child, no workspace/fork requirement.
- High-assurance review is intentionally expensive: mean wall `+123.57%`, input `+182.62%`, OpenCode-derived cost `+344.48%` versus low-risk direct review.
- Decision: retain **zero reviewer for low-risk deterministic review** and **exactly one fresh reviewer only when material assurance/independence requires it**. No generic reviewer defect-detection superiority claim.
- Aggregate SHA-256 `76b235c220d739d2600fc96e3fc3b44e6729d72b10b7872dc46cce5bb24d1761`.

## Final verification

Exact Git archive of `1bf47ac4a51f5e30e30ca9269821e369fac9f332`:

- build PASS;
- architecture lint `22/22 PASS`;
- plugin suite `977/977 PASS`;
- full-check log SHA-256 `ecabd6efa63f2fa2b5949041548add8026766042b781d2b1bbea1c57c92aaa94`.

All monetary values above are OpenCode-derived, not provider-billed cost. Provider-side remaining quota was not observed and is not claimed. Unrelated dirty validation/release/script/routing files were preserved. No push/tag/release/npm publish was performed.
