# Host Boundary

OpenCode is the reference host for 0.1.x. Core mission, evidence, authority, completion, execution policy, context policy, topology, failure, and human-decision semantics do not require OpenCode SDK types.

A capability manifest resolves host features as `NATIVE`, `SAFE_EMULATION`, `DEGRADED`, or `UNSUPPORTED`; compatibility is never faked. The current reference-host version/status is generated from exact receipts in `data/validation/compatibility-matrix-0.1.0.json`; do not hand-maintain a second latest-host value here. Hi now owns a `ProcessExecutor` port and an OpenCode PTY adapter over the canonical v2 PTY surface, including PID-bound spawn, ticketed WebSocket input/output, bounded cursor reads, timeout signalling, exit observation, kill and separate cleanup. Ordinary model-facing bash is not silently replaced by this executor. Hi-owned process execution now has event-driven WAIT, explicit STOP termination/cleanup, restart re-adoption with PID+cwd+native-command identity, orphan quarantine, and exact OpenCode 1.18.18 T3 acceptance; `process_events` is `NATIVE` and `process-lifecycle` is `SUPPORTED` for the Hi-owned process surface. W1 defines strict Hi `IsolationDecision` and `WorkspaceLease` contracts, and W2 now owns an `OpenCodeWorkspaceAdapter`/`WorkspaceRuntime` over the official OpenCode 1.18.18 experimental workspace API using the builtin `worktree` adapter. Child creation passes `workspaceID` and fail-closes unless returned child `workspaceID + directory` exactly match the lease; restart adopts only an existing same-repository registered worktree and never silently recreates one. W3 exact OpenCode 1.18.18 real-host acceptance now proves the Hi-owned workspace chain end to end: source-bound worktree provisioning, exact child `workspaceID + directory` routing, real model/tool writes confined to the lease, verification executed from the leased worktree, primary/user-dirty preservation, cleanup, restart adoption, and orphan quarantine without recreation. Therefore `workspace_isolation` is `NATIVE` at the reference-host primitive layer and `workspace-isolation-binding` is `SUPPORTED` at `REAL_HOST_ACCEPTANCE` for the Hi-owned isolation surface. B3 now closes the browser boundary on exact OpenCode 1.18.18 source acceptance: Hi owns a health-gated `BrowserRuntime` backed by `PlaywrightBrowserAdapter`, exact visual worker/task/session/generation ownership, bounded local HTTP(S) targets, observed `@eN` interaction references, and canonical screenshot artifact persistence. The exact accepted source is `476590e500949ec6c2416c1502beaa9be4217d9f`; therefore `browser-execution` is `SUPPORTED` at `REAL_HOST_ACCEPTANCE` only while live executor health is present. MCP/tool discovery still grants nothing by itself. Doctor reports live health separately, and a missing browser runtime fails closed before visual/browser child execution.


## Exact accepted capability matrix

<!-- BEGIN GENERATED HOST CAPABILITY MATRIX -->
Generated from `data/validation/compatibility-matrix-0.1.0.json`. Current recorded exact host: OpenCode `1.18.18` on `linux/aarch64`.

| Hi capability | Status | Exact source | Receipt |
|---|---|---|---|
| `browser-execution` | **SUPPORTED_T3** | `59288454a1a03fceba2cd76dbdf59efecb41aa21` | `data/validation/external-opencode-hi-0.1.0-browser-1.18.18-head-5928845.json` |
| `process-lifecycle` | **SUPPORTED_T3** | `2e7813f218c54de44073d1c851d180960e3d0911` | `data/validation/external-opencode-hi-0.1.0-lifecycle-1.18.18-head-2e7813f.json` |
| `workspace-isolation-binding` | **SUPPORTED_T3** | `814acc48675ffa0d84fdb124ca315b403b922ec8` | `data/validation/external-opencode-hi-0.1.0-workspace-1.18.18-head-814acc4.json` |

This table is a projection, not evidence ownership: the referenced exact receipts remain the capability proof. Historical negative/older receipts remain preserved in the generated compatibility history.
<!-- END GENERATED HOST CAPABILITY MATRIX -->


## Role boundary

Hi Core role identity and authority live in `plugin/src/runtime/roles/catalog.ts`: the canonical primary/child role family, read-only/reviewer classes, and child obligation ownership are host-independent product semantics.

`roles/*.md` are OpenCode reference-host adapter templates. Their frontmatter expresses OpenCode-native agent mode and permissions, and `scripts/generate_plugin_agents.py` derives the packaged OpenCode agent definitions. A future host adapter may bind the same Hi Core roles to different native primitives without changing Core role ownership.

## Semantic context capability boundary

Semantic Context is Hi Core context capability, not an OpenCode-native host capability. The current explicit adapter surface contains only `TypeScriptSemanticContextAdapter` for `.ts`/`.tsx` (`typescript`, `typescriptreact`). No LSP semantic adapter, Tree-sitter adapter, or JavaScript adapter is currently claimed. A future host-backed semantic adapter must be added behind `SemanticContextAdapter` and separately proven before documentation may advertise it.

## Process lifecycle capability boundary

`ProcessContract` is the Hi Core semantic contract and P2 wires a Hi `ProcessExecutor` instance through runtime services using `OpenCodePtyAdapter`. The adapter uses OpenCode's canonical v2 PTY create/get/remove/connect-token surface plus the ticketed WebSocket protocol for stdin and cursor-bounded output. Spawn is fail-closed against the effective OpenCode role permission map: explicit `deny` is denied, `ask` is transported through OpenCode's native permission request and an `once` grant applies only to the exact pending pattern, external cwd requires explicit `external_directory` authority, and classified external side effects require a matching Hi `ExternalAction`/authority reference. Kill validates the observed PID before signalling; cleanup is a distinct terminal-state operation and cannot masquerade as kill. Restart reconciliation re-adopts only an exact PID+cwd+native-command identity and quarantines mismatches without signalling them. Exact OpenCode 1.18.18 T3 acceptance proves spawn/PID, stdin, bounded cursor reads, WAIT/exit, nonzero exit, timeout, kill/cleanup separation, restart adoption, native permission `once`, and semantic STOP cleanup. This support claim applies only to the Hi-owned process surface; arbitrary native bash jobs remain outside Hi ownership.

## HumanDecision transport surface

Hi's H1 chat transport is host-independent and runtime-scoped. For an optional structured OpenCode UI adapter, the required primitive is stronger than question event visibility: the plugin must be able to directly open a typed request bound to the exact canonical `decision_id`, then receive/reject that same request without model mediation. OpenCode 1.18.18 public SDK exposes `question.list/reply/reject` but no plugin-callable `question.ask/open`, so `structured-human-decision-transport` remains `UNSUPPORTED`. The internal model `question` tool is not treated as an adapter seam. This question/UI limitation is independent from the separately accepted `browser-execution` capability; browser support does not create or widen HumanDecision transport authority.

## Browser observation boundary

B1 defines a strict host-independent `BrowserObservation` contract before any executor is admitted. An observation binds task, executor version, URL, action, timestamp and optional document identity/DOM/error/screenshot artifact reference into a deterministic observation ID. Raw screenshot bytes are not embedded in the contract, and an observation is never automatically Evidence or verification PASS. `BrowserObservation` remains non-Evidence even though B2/B3 now supply an owned executor and exact real-host browser/visual proof. Capability support never auto-promotes an observation or screenshot to verification PASS.

## Browser executor boundary

B1 defines strict `BrowserObservation` provenance and B2 defines the host-independent `BrowserExecutor` port. B3 now binds production execution to Hi's `PlaywrightBrowserAdapter`/`BrowserRuntime`: configured local HTTP(S) origin confinement, exact canonical child ownership, observed `@eN` refs, bounded DOM/error output, health probing, and screenshot success only after persistence through the canonical Hi artifact owner. Exact OpenCode 1.18.18 T3 on source `476590e500949ec6c2416c1502beaa9be4217d9f` exercised health, navigation, DOM inspection, click, type, screenshot, close, deterministic invalid-target failure, visual-task preflight, native methodology loading, explicit passed browser/visual evidence, methodology exits, verification closure, and Mission completion. `browser-execution` is therefore `SUPPORTED` at `REAL_HOST_ACCEPTANCE` for this owned surface and remains runtime-health-gated; missing health removes the executable resource and preflight fails closed.


## Generated compatibility projection

The machine-readable compatibility view is generated from exact host receipts by `scripts/generate-compatibility-matrix.py` into `data/validation/compatibility-matrix-0.1.0.json`. Receipts remain canonical evidence; the projection owns no capability state. It keeps historical/non-exact observations instead of deleting them and selects current capability proof by exact-source Git history order for the highest exact-tested OpenCode version. Consumers should read that projection rather than hand-maintaining a second OpenCode-version/support table. `data/runtime/opencode-compatibility.json` is a different artifact: it describes the runtime adapter/hook contract and must not be treated as T3 support evidence.
