# M11 Model Routing & Recovery Evidence Checkpoint — 2026-08-18

## Scope

Closed the model-routing evidence slice of M11 on immutable product commit `d0ae80605609dd9f204e9e8df21d1f9c123a4052`. This checkpoint does **not** close M11; decomposition and fresh-reviewer value experiments remain active.

## Exact committed verification

- immutable image: `/workspace/Reference/phase2-autopilot/opencode-hi-m11-d0ae806`
- build + architecture lint + full plugin suite: PASS
- architecture: `22/22 PASS`
- plugin suite: `974/974 PASS`
- check log SHA-256: `884222577c286d5c65c69f2587148035934dcf105ecdcbf78d015729a5bfbbdb`

## Exact role/model attribution

- primary role aggregate: `/workspace/Reference/phase2-autopilot/m11-role-primary-coverage-aggregate.json`
- SHA-256: `a62f2228d412de539ebbc00f7c1565c3da3d9585405732a66f7cbd798b8126dd`
- repository-explorer → `opencode-go/mimo-v2.5`
- architect → `opencode-go/qwen3.7-plus`
- qa-reviewer → `opencode-go/hy3`
- security-reviewer → `opencode-go/mimo-v2.5-pro`
- every primary role episode: exact selected/effective/session-observed identity + completed/DONE child settlement.

Role-compatible alternates were tested without inventing permanent roles:
- aggregate: `/workspace/Reference/phase2-autopilot/m11-role-alternate-coverage-aggregate.json`
- SHA-256: `9c8fda1dbdd6e903ffad706abfd72d0826d84ce945ec11b2481d441ed8fa22e6`
- architect + explicit `opencode-go/minimax-m2.7`: exact request/selected/effective attribution, completed/DONE.
- qa-reviewer + explicit `opencode-go/qwen3.6-plus`: exact request/selected/effective attribution, completed/DONE.
- These alternate episodes are compatibility/attribution evidence, not default-prior superiority evidence.

## Empirical rerank admission

- aggregate: `/workspace/Reference/phase2-autopilot/m11-empirical-rerank-realhost-aggregate.json`
- SHA-256: `05a2b01e111c3e1f5374c7a579f44a8cec3b3dee081fd3307bb034b216b5dde6`
- sparse arm: one MiMo + one DeepSeek completed coder sample did not admit reranking; third implicit coder remained DeepSeek with `recommended-fast-path:role-override-available,skip-scoring`.
- admitted arm: two completed MiMo coder samples crossed the current low-confidence threshold; third implicit coder selected/effectively ran MiMo with `empirical-feedback-reranked-configured-priors`.
- This proves bounded mission-local admission behavior, not global model superiority. Observed latency is recorded by feedback telemetry but is not currently a scoring term.

## Fallback / escalation

- evidence manifest: `/workspace/Reference/phase2-autopilot/m11-fallback-escalation-evidence.json`
- SHA-256: `0dcdf828217b58702883a34495e5730b334f4f513ada47b7f13bbc1b2b757f15`
- real-host resolution-time unavailable model: requested `opencode-go/m11-nonexistent-model`, resolver selected/effectively ran `opencode-go/deepseek-v4-flash`; task/worker completed/DONE; missing model never appeared in child assistant metadata; receipt valid.
- deterministic runtime-recovery gate: `26/26 PASS`; log SHA-256 `ab14fe5c00403b42a46a50ec12a01c060baa039e81216d5a7e70e8474a15e3f4`.
- covered runtime recovery semantics: fresh-child provider fallback, next-fallback progression, abort-unavailable fail-closed behavior, fallback exhaustion, provider-failure classification, level-2 same-session model escalation, and variant/fallback concurrency invariants.

### Real-host runtime provider-failure limitation

Pinned OpenCode `1.18.18` accepted a project-local custom OpenAI-compatible provider configuration, but direct localhost failure probes did not settle within the benchmark's 20-second outer ceiling, including a local HTTP stub that returned 503 immediately. Therefore this checkpoint **does not claim** real-host runtime provider-failure recovery. That behavior remains deterministic-contract verified only. No repeated provider probe is justified until the host behavior or benchmarkable failure surface changes.

## Economics / quota provenance

- All monetary values are OpenCode-derived unless separately observed otherwise; none are presented as provider-billed cost.
- User request-count numbers remain Hi planning authority, not observed provider counters.
- Provider remaining quota remains `UNKNOWN` unless mechanically observed.

## Decision

Retain the M11 role-prior + confidence-admitted configured-prior reranking behavior already present in `d0ae806`. No additional product-code change was justified by this evidence slice. Continue M11 with zero/one/many decomposition and fresh-reviewer value experiments.
