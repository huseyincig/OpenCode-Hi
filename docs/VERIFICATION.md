# Verification Strategy

Verification is risk-proportional and evidence-aware. Low risk uses targeted checks; medium risk adds dependency-aware verification; high risk adds broader integration/review only when materially justified. Verification stops when sufficient evidence-based confidence exists and does not spiral toward maximum possible certainty.

Current local acceptance covers adaptive execution/topology, mission completion/continuation, context protection, file-scoped Project Intelligence, operational TypeScript Semantic Context, privacy redaction, structured human-decision/authority gates, materially different retry, shell-policy enforcement, host capability truthfulness, safe methodology resources, and telemetry metrics. Exact OpenCode 1.18.16 exposes PTY and workspace/session primitives, but current Hi does not claim them as equivalent product capabilities: ordinary bash process lifecycle remains `DEGRADED`, alternate-workspace child execution remains `UNSUPPORTED`, and deterministic browser execution remains `UNSUPPORTED`. The limitation is an ownership/binding/proof boundary, not an assertion that the host SDK contains no related primitive.


## Current 0.1.0 receipts

- `data/validation/benchmarks-0.1.0.json`: nine deterministic execution-policy scenarios.
- `data/validation/install-lifecycle-0.1.0.json`: local plan/install/doctor/reconfigure/uninstall lifecycle with unrelated user configuration preserved.
- `data/validation/architecture-audit-0.1.0.json`: final architecture-invariant audit.

The current controlled environment exposes OpenCode `1.18.16`; historical and current-worktree real-host receipts remain source-bound and are never promoted across source changes. Local policy tests are not substitutes for exact-candidate T3 acceptance where host-bound behavior changed.
