# OpenCode-Hi Active Task State

**Project:** `/workspace/OpenCode-Hi`
**Status:** ACTIVE — PHASE 2 / MILESTONE 11
**Updated:** 2026-08-18
**Global authority:** `/workspace/PROTOCOL.md`
**Project policy:** `/workspace/OpenCode-Hi/PROTOCOL.md`
**Roadmap:** `/workspace/OpenCode-Hi/ROADMAP.md`

## Active Task

### M11 — Adaptive Decomposition, Model & Review Intelligence

Model-routing evidence is checkpointed. The active M11 work is now decomposition economics/correctness plus fresh-reviewer value: choose zero/one/many workers from the work graph, and require independent review only when material assurance benefit justifies it.

## Current User-Authoritative OpenCode Go Planning Priors

| Role / purpose | Exact primary prior | 5h / week / month planning requests |
| --- | --- | --- |
| test engine, DIRECT controller, dispatcher | `opencode-go/mimo-v2.5` | 30,100 / 75,200 / 150,400 |
| coder/tool specialist | `opencode-go/deepseek-v4-flash` | 7,600 / 18,900 / 37,800 |
| WorkGraph planner/dependency architect | `opencode-go/qwen3.7-plus` | 4,300 / 10,800 / 21,600 |
| verifier/browser/tool supervisor | `opencode-go/hy3` | 4,300 / 10,750 / 21,500 |
| synthesis/documentation/recovery | `opencode-go/minimax-m2.7` | 3,400 / 8,500 / 17,000 |
| adversarial/edge-case validator | `opencode-go/qwen3.6-plus` | 3,300 / 8,200 / 16,300 |
| principal fresh reviewer/final assurance | `opencode-go/mimo-v2.5-pro` | 3,250 / 8,150 / 16,300 |

These request counts are Hi planning authority, not observed provider remaining quota. Provider remaining stays `UNKNOWN` unless mechanically observed. OpenCode-derived cost is never provider-billed cost.

## Completed M11 Checkpoints

- Role-routing product checkpoint: `agent-archive/2026-08-18-m11-role-routing-checkpoint.md`, retained product commit `d0ae80605609dd9f204e9e8df21d1f9c123a4052`.
- Model routing/recovery evidence: `agent-archive/2026-08-18-m11-model-routing-evidence.md`.
- Immutable `d0ae806` verification: architecture `22/22 PASS`, plugin suite `974/974 PASS`; log SHA-256 `884222577c286d5c65c69f2587148035934dcf105ecdcbf78d015729a5bfbbdb`.
- Seven declared model priors/alternates have exact requested/selected/effective attribution coverage; mission-local empirical rerank threshold is real-host verified; resolution-time fallback is real-host verified; runtime provider failure recovery and level-2 escalation are deterministic-contract verified. Authentic localhost provider-failure probes did not settle within the 20s ceiling, so no real-host runtime-recovery success claim is made.

## M11 Acceptance Still Open

- compare **zero vs one** worker on bounded local work and retain delegation only when task-level correctness/predictability or measured economics justify it;
- compare **one vs many** workers on genuinely independent and dependency/fan-in work without overlapping uncontrolled writers or ambiguous fan-in;
- prove fresh reviewer is skipped for low-risk deterministic work and used only when material independence/assurance benefit exists;
- measure reviewer benefit against its extra context/model/tool/cost overhead; no reviewer ceremony by default;
- retain changes only for deterministic correctness/predictability or measured task-class efficiency.

## Required Verification

- deterministic decomposition/minimum-team/reviewer contract tests;
- architecture lint + exact isolated plugin suite for any retained product-code change;
- repeated hash-bound real-host comparisons using MiMo-V2.5 as parent/test controller unless the model is the explicit independent variable;
- preserve failure repetitions and exact requested/effective attribution; do not claim provider-billed economics or unknown quota.

## Exact Next Action

Characterize current zero/one/many decomposition and fresh-reviewer decision owners on immutable `d0ae806`. Reuse the existing M8 parallel/fan-in/conflict evidence where its fixture and semantics still match current code, but do not assume those results prove M11 economics. Define the smallest new real-host comparator that isolates **DIRECT zero-child vs one coder child** on the same bounded local implementation, with parent MiMo and identical external acceptance. Then define a reviewer comparator where low-risk deterministic evidence should skip review while a materially high-assurance review mission requires a fresh reviewer. Retain no new product behavior until repeated evidence justifies it.
