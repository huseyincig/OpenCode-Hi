# Host Boundary

OpenCode is the reference host for 0.2.x. Core mission, evidence, authority, completion, execution policy, context policy, topology, failure, and human-decision semantics do not require OpenCode SDK types.

A capability manifest resolves host features as `NATIVE`, `SAFE_EMULATION`, `DEGRADED`, or `UNSUPPORTED`; compatibility is never faked. Runtime capability contracts report only what the active host actually exposes: process PTY and workspace API probes plus browser executor health can yield `SUPPORTED` or `UNSUPPORTED` at verification level `OBSERVED`. Process PTY health is re-observed at each `hi_process_spawn` admission and on explicit doctor runs, so a stale `SUPPORTED` or `UNSUPPORTED` projection cannot by itself authorize or suppress a new owned process. Adapter presence, SDK method shape, a mock client, or a green unit test cannot promote `REAL_HOST_ACCEPTANCE` or T3. Exact T3 support is a separate certification layer owned by external source-bound receipts and selected through `data/validation/compatibility-matrix-0.1.0.json`; the generated table below is the current projection and must not be hand-maintained. Hi-owned ProcessRuntime remains PID/process-group/cwd/command-identity bound with bounded output, timeout, kill, cleanup, restart adoption, and orphan quarantine. Workspace isolation remains Mission-owned through strict `IsolationDecision` / `WorkspaceLease`, OpenCode builtin worktree provisioning, exact child `workspaceID + directory` binding, primary/user-state preservation, cleanup, restart adoption, and orphan quarantine without recreation. Browser execution remains health-gated through the `BrowserExecutor` port / `PlaywrightBrowserAdapter`, local HTTP(S) confinement, execution-owner isolation, observed `@eN` references, bounded DOM/error output, and screenshot artifact persistence. Doctor reports this live `OBSERVED` capability health; it does not certify T3. MCP/tool discovery grants nothing by itself, and unavailable owned capabilities fail closed before execution.


## Current development host-generation certification

This section describes the **current source checkout**, not a new published release. Published `0.2.4` evidence remains immutable at its exact release boundary. The host-independence program mechanically certifies the current development architecture as capability-driven: OpenCode version is evidence metadata, while runtime behavior is selected through semantic host capabilities and adapters.

- **Current/V1 exact baseline — OpenCode 1.18.21:** fresh packed consumer PASS with 37/37 current-development Hi tools, canonical coder projection, session creation and setup.
- **Latest stable observed — OpenCode 1.18.25:** fresh packed candidate material-runtime PASS with 37 tools, coder agent, session creation and no plugin-load error. This row does not fabricate provider-backed semantic evidence beyond what was executed.
- **V2 Promise — `0.0.0-beta-18721`:** primary V2 adapter target. Fresh candidate package loaded through the native V2 server entry and a native `hi_intent_assess` invocation reached the canonical `NON_MATERIAL` result. Earlier real-host V2 certification also covers native child execution and terminal reconciliation.
- **V2 Effect:** official alternate/equivalent host loading path; Hi does not maintain a second semantic implementation when upstream bridges Promise setup into the Effect loader.
- **Synthetic future generation:** deliberately alien session IDs, child methods, lifecycle/event names, model/usage payloads and missing/degraded capabilities were connected through the same semantic ports with **46 canonical core files checked / 0 core mutations**. This proves the adapter architecture; it is not a claim that an unreleased OpenCode V3 exists.

Optional capabilities never silently disappear. Adapter resolution produces explicit full support, named degraded fallback/semantic loss, or unsupported state. Runtime observation has precedence over advertised capability, safe probe and bounded version metadata. A new host generation should therefore normally require only capability inventory/mapping, an edge adapter, degradation rules, parity tests and a compatibility-matrix row; host-only change is not authority to edit Mission/Task/Worker/Scheduler/Evidence/Authority/Recovery/Continuation/Routing semantics.


## Exact accepted capability matrix

<!-- BEGIN GENERATED HOST CAPABILITY MATRIX -->
Generated from `data/validation/compatibility-matrix-0.1.0.json`. Current recorded exact host: OpenCode `1.18.21` on `linux/aarch64`.

| Hi capability | Status | Exact source | Receipt |
|---|---|---|---|
| `browser-execution` | **SUPPORTED_T3** | `46b5dd71bb18378e9436a3ad4f74221fce6c9d6a` | `data/validation/external-opencode-hi-0.2.4-browser-1.18.21-head-46b5dd7.json` |
| `process-lifecycle` | **SUPPORTED_T3** | `46b5dd71bb18378e9436a3ad4f74221fce6c9d6a` | `data/validation/external-opencode-hi-0.2.4-process-1.18.21-head-46b5dd7.json` |
| `workspace-isolation-binding` | **SUPPORTED_T3** | `46b5dd71bb18378e9436a3ad4f74221fce6c9d6a` | `data/validation/external-opencode-hi-0.2.4-workspace-1.18.21-head-46b5dd7.json` |

This table is a projection, not evidence ownership: the referenced exact receipts remain the capability proof. Historical negative/older receipts remain preserved in the generated compatibility history.
<!-- END GENERATED HOST CAPABILITY MATRIX -->


## Role boundary

Hi Core role identity and authority live in `plugin/src/runtime/roles/catalog.ts`: the canonical primary/child role family, read-only/reviewer classes, and child obligation ownership are host-independent product semantics.

`roles/*.md` are OpenCode reference-host adapter templates. Their frontmatter expresses OpenCode-native agent mode and permissions, and `scripts/generate_plugin_agents.py` derives the packaged OpenCode agent definitions. A future host adapter may bind the same Hi Core roles to different native primitives without changing Core role ownership.

## Model inventory boundary

OpenCode remains the sole owner of provider authentication and runtime model availability. Current `dev` normalizes two OpenCode-owned views without creating a Hi catalog: the directory-scoped enabled `/api/model` projection and the provider surface's explicit `connected` state. When `connected` is present it is the provider-membership gate: scoped rows from providers outside that set are removed. Within connected providers, `/api/model` remains authoritative for model membership and broader provider metadata cannot reintroduce a model filtered from an already represented provider. A connected provider absent from the scoped projection may contribute models from OpenCode provider state. If no explicit connected-provider set exists, Hi preserves the successful scoped projection without widening; if the provider read fails, the scoped projection remains usable. This reconciliation is a host-adapter completeness rule, not routing priority or a provider retry/fallback mechanism. OpenCode App “Manage Models” show/hide state is client-local persistence in exact 1.18.21 and current fetched upstream source, with no HTTP/SDK visibility contract; Hi does not scrape or elevate that UI preference into server availability truth.

## Semantic context capability boundary

Semantic Context is Hi Core context capability, not an OpenCode-native host capability. The current explicit adapter surface contains only `TypeScriptSemanticContextAdapter` for `.ts`/`.tsx` (`typescript`, `typescriptreact`). No LSP semantic adapter, Tree-sitter adapter, or JavaScript adapter is currently claimed. A future host-backed semantic adapter must be added behind `SemanticContextAdapter` and separately proven before documentation may advertise it.

## Process lifecycle capability boundary

`ProcessContract` is the Hi Core semantic contract and Hi wires a `ProcessExecutor` instance through runtime services using `OpenCodePtyAdapter`. The adapter uses OpenCode's canonical v2 PTY create/get/remove/connect-token surface plus the ticketed WebSocket protocol for stdin and cursor-bounded output. On the certified POSIX reference-host path, the requested command is held behind a bounded attach-ready barrier until the initial replay/cursor metadata and internal ready marker are observed; the marker is excluded from user-visible output and restart replay. Spawn is fail-closed against the effective OpenCode role permission map: explicit `deny` is denied, `ask` is transported through OpenCode's native permission request and an `once` grant applies only to the exact pending pattern, external cwd requires explicit `external_directory` authority, and classified external side effects require a matching Hi `ExternalAction`/authority reference. Kill validates the observed PID before signalling; cleanup is a distinct terminal-state operation and cannot masquerade as kill. Restart reconciliation re-adopts only an exact PID+cwd+native-command identity and quarantines mismatches without signalling them. A current exact OpenCode 1.18.19 T3 claim requires a current/equivalent exact-source receipt covering spawn/PID, stdin, bounded cursor reads, quick exit, nonzero exit, timeout, kill/cleanup separation, restart adoption, native permission `once`, and semantic STOP cleanup; historical receipts are baseline provenance only after capability-relevant runtime bytes change. This support claim applies only to the Hi-owned process surface; arbitrary native bash jobs remain outside Hi ownership.

## Workspace isolation capability boundary

OpenCode 1.18.19 gates its experimental workspace control plane behind `OPENCODE_EXPERIMENTAL_WORKSPACES`; when that variable is unset it inherits the broader `OPENCODE_EXPERIMENTAL` flag, while an explicit workspace-specific false value wins. Hi mirrors that exact host prerequisite: `OpenCodeWorkspaceAdapter.health()` does not treat a successful workspace-list response as usable isolation when the feature is disabled, and `provision()` refuses to create a workspace until the host was started with workspace support enabled. This prevents the OpenCode 1.18.19 failure mode where a worktree can be materialized but the host returns `WorkspaceCreateError: Timed out waiting for global event` without a durable workspace ID. Exact T3 records the workspace feature flag as part of the host boundary.

## HumanDecision transport surface

Hi's chat transport is host-independent and runtime-scoped. For an optional structured OpenCode UI adapter, the required primitive is stronger than question event visibility: the plugin must be able to directly open a typed request bound to the exact canonical `decision_id`, then receive/reject that same request without model mediation. OpenCode 1.18.21 and the current fetched upstream public SDK surface expose `question.list/reply/reject` but no plugin-callable `question.ask/open`, so `structured-human-decision-transport` remains `UNSUPPORTED`. The internal model `question` tool is not treated as an adapter seam. This question/UI limitation is independent from the separately accepted `browser-execution` capability; browser support does not create or widen HumanDecision transport authority.

## Browser observation boundary

`BrowserObservation` is a strict host-independent contract defined before any executor is admitted. An observation binds task, executor version, URL, action, timestamp and optional document identity/DOM/error/screenshot artifact reference into a deterministic observation ID. Raw screenshot bytes are not embedded in the contract, and an observation is never automatically Evidence or verification PASS. `BrowserObservation` remains non-Evidence even when an owned executor and exact real-host browser/visual proof are available. Capability support never auto-promotes an observation or screenshot to verification PASS.

## Browser executor boundary

`BrowserObservation` defines strict provenance and `BrowserExecutor` defines the host-independent execution port. Production execution is bound to Hi's `BrowserExecutor` port / `PlaywrightBrowserAdapter` with task-bound backend policy and ownership checks: configured local HTTP(S) origin confinement, exact execution-owner identity, observed `@eN` refs, bounded DOM/error output, live health probing, and screenshot success only after persistence through the canonical Hi artifact owner. Development `0.2.3` added a bounded first-use local Chromium bootstrap through pinned `playwright-core@1.62.1`; immutable published `0.2.4` retains its Hi-owned platform-cache behavior. Current `dev` resolves the same abstract `browser-execution` requirement through `OperationalToolProvisioner`: an existing implementation is preferred, managed fallback Chromium is confined to `.opencode/hi/tools/browser-execution/playwright-chromium/<version>`, and smoke health is required before capability use. This is operational tooling, never application dependency state. Bootstrap failure remains an explicit unavailable capability/environment state rather than a model/reasoning retry source. At runtime, browser support is only `SUPPORTED/OBSERVED` when live executor health is available; missing health removes the executable resource and preflight fails closed. Exact OpenCode T3 is not encoded here as a runtime self-claim: it is owned by the external acceptance receipt selected in the generated compatibility matrix above.


## Generated compatibility projection

The machine-readable compatibility view is generated from exact host receipts by `scripts/generate-compatibility-matrix.py` into `data/validation/compatibility-matrix-0.1.0.json`. Receipts remain canonical evidence; the projection owns no capability state. It keeps historical/non-exact observations instead of deleting them and selects current capability proof by exact-source Git history order for the highest exact-tested OpenCode version. Consumers should read that projection rather than hand-maintaining a second OpenCode-version/support table. `data/runtime/opencode-compatibility.json` is a different artifact: it describes the runtime adapter/hook contract and must not be treated as T3 support evidence.
