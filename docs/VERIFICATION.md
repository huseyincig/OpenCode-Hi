# Verification Strategy

Verification is risk-proportional and evidence-aware. Low risk uses targeted checks; medium risk adds dependency-aware verification; high risk adds broader integration/review only when materially justified. Verification stops when sufficient evidence-based confidence exists and does not spiral toward maximum possible certainty.

Current local acceptance covers adaptive execution/topology, mission completion/continuation, context protection, file-scoped Project Intelligence, operational TypeScript Semantic Context, privacy redaction, structured human-decision/authority gates, materially different retry, shell-policy enforcement, host capability truthfulness, safe methodology resources, telemetry metrics, and the Hi-owned process lifecycle. Exact-host acceptance on OpenCode 1.18.18 proves the owned PTY process surface end to end: PID-bound spawn, stdin, bounded reads, native WAIT/exit, nonzero exit, timeout, kill/cleanup separation, restart adoption, exact native permission `once`, and semantic STOP cleanup. Exact-host acceptance on OpenCode 1.18.18 also proves the Hi-owned alternate-workspace chain: source-bound lease creation, exact child workspace binding, real isolated write, verification from the lease, unchanged primary/user-dirty state, cleanup, restart adoption, and orphan quarantine without recreation. `workspace-isolation-binding` is therefore `SUPPORTED` at `REAL_HOST_ACCEPTANCE`. Deterministic browser execution remains `UNSUPPORTED`; related host primitives alone do not promote it.


## Current 0.1.0 receipts

- `data/validation/external-opencode-hi-0.1.0-host-1.18.18-head-bc85854.json`: exact-source OpenCode 1.18.18 P3 process lifecycle T3 receipt bound to `bc8585496e93b294d43f1a25a66117faa28524f0`; workspace/browser remain unsupported.
- `data/validation/external-opencode-hi-0.1.0-workspace-1.18.18-head-92812a1.json`: exact-source OpenCode 1.18.18 W3 workspace-isolation T3 receipt bound to `92812a13b7388387b11096a74a26bdb13fc4dffb`; `workspace-isolation-binding=SUPPORTED/REAL_HOST_ACCEPTANCE`, browser remains unsupported.

- `data/validation/benchmarks-0.1.0.json`: nine deterministic execution-policy scenarios.
- `data/validation/install-lifecycle-0.1.0.json`: local plan/install/doctor/reconfigure/uninstall lifecycle with unrelated user configuration preserved.
- `data/validation/architecture-audit-0.1.0.json`: final architecture-invariant audit.

The current exact process-lifecycle and workspace-isolation acceptance host is OpenCode `1.18.18`; each capability remains bound to its own exact tested source receipt, and older receipts are never promoted across source changes. Local policy tests are not substitutes for exact-candidate T3 acceptance where host-bound behavior changed.

P1 ProcessContract validation remains the strict structural base. P2/P3 controlled tests plus the exact OpenCode 1.18.18 T3 receipt provide the executor/lifecycle proof required for the current `SUPPORTED` process-lifecycle claim; raw output remains excluded from durable ProcessContract state.

B1 BrowserObservation contract validation is local/T1 contract evidence only. It does not satisfy browser/visual methodology evidence and does not change `browser-execution=UNSUPPORTED`; executor and real-host proof belong to B2/B3.

B2 controlled acceptance covers the Hi `BrowserExecutor` port and local browser-CLI adapter command mapping, target-origin confinement, exact session binding, bounded element/type/wait/output handling, screenshot artifact binding, health failure, and the invariant that implementation alone does not promote `browser-execution`. B3 exact real-host browser proof is still required before support can change from `UNSUPPORTED`.
