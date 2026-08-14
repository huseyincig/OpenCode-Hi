# Verification Strategy

Verification is risk-proportional and evidence-aware. Low risk uses targeted checks; medium risk adds dependency-aware verification; high risk adds broader integration/review only when materially justified. Verification stops when sufficient evidence-based confidence exists and does not spiral toward maximum possible certainty.

Current local acceptance covers adaptive execution/topology, mission completion/continuation, context protection, file-scoped Project Intelligence, operational TypeScript Semantic Context, privacy redaction, structured human-decision/authority gates, materially different retry, shell-policy enforcement, host capability truthfulness, safe methodology resources, telemetry metrics, and the Hi-owned process lifecycle. Exact-host acceptance on OpenCode 1.18.18 proves the owned PTY process surface end to end: PID-bound spawn, stdin, bounded reads, native WAIT/exit, nonzero exit, timeout, kill/cleanup separation, restart adoption, exact native permission `once`, and semantic STOP cleanup. Alternate-workspace child execution remains `UNSUPPORTED`, and deterministic browser execution remains `UNSUPPORTED`; related host primitives alone do not promote those capabilities.


## Current 0.1.0 receipts

- `data/validation/external-opencode-hi-0.1.0-host-1.18.18-head-bc85854.json`: exact-source OpenCode 1.18.18 P3 process lifecycle T3 receipt bound to `bc8585496e93b294d43f1a25a66117faa28524f0`; workspace/browser remain unsupported.

- `data/validation/benchmarks-0.1.0.json`: nine deterministic execution-policy scenarios.
- `data/validation/install-lifecycle-0.1.0.json`: local plan/install/doctor/reconfigure/uninstall lifecycle with unrelated user configuration preserved.
- `data/validation/architecture-audit-0.1.0.json`: final architecture-invariant audit.

The current exact process-lifecycle acceptance host is OpenCode `1.18.18`; older 1.18.16/1.18.18 receipts remain historical source-bound provenance and are never promoted across source changes. Local policy tests are not substitutes for exact-candidate T3 acceptance where host-bound behavior changed.

P1 ProcessContract validation remains the strict structural base. P2/P3 controlled tests plus the exact OpenCode 1.18.18 T3 receipt provide the executor/lifecycle proof required for the current `SUPPORTED` process-lifecycle claim; raw output remains excluded from durable ProcessContract state.
