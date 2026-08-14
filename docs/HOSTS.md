# Host Boundary

OpenCode is the reference host for 0.1.x. Core mission, evidence, authority, completion, execution policy, context policy, topology, failure, and human-decision semantics do not require OpenCode SDK types.

A capability manifest resolves host features as `NATIVE`, `SAFE_EMULATION`, `DEGRADED`, or `UNSUPPORTED`; compatibility is never faked. The latest completed exact-host acceptance is OpenCode 1.18.18. Hi now owns a `ProcessExecutor` port and an OpenCode PTY adapter over the canonical v2 PTY surface, including PID-bound spawn, ticketed WebSocket input/output, bounded cursor reads, timeout signalling, exit observation, kill and separate cleanup. Ordinary model-facing bash is not silently replaced by this executor, and WAIT/STOP/restart reconciliation plus exact T3 proof remain P3 work, so `process_events`/`process-lifecycle` remain `DEGRADED`. Hi has no canonical isolation selection/provisioning/cleanup executor or real-host proof that child tool execution is bound to an alternate workspace, so `workspace_isolation` remains `UNSUPPORTED`. MCP/tool discovery likewise does not provide a deterministic browser-evidence executor, so `browser-execution` remains `UNSUPPORTED`. Doctor reports the remaining limitations; capability status changes only after owned executor evidence closes the corresponding acceptance boundary.


## Role boundary

Hi Core role identity and authority live in `plugin/src/runtime/roles/catalog.ts`: the canonical primary/child role family, read-only/reviewer classes, and child obligation ownership are host-independent product semantics.

`roles/*.md` are OpenCode reference-host adapter templates. Their frontmatter expresses OpenCode-native agent mode and permissions, and `scripts/generate_plugin_agents.py` derives the packaged OpenCode agent definitions. A future host adapter may bind the same Hi Core roles to different native primitives without changing Core role ownership.

## Semantic context capability boundary

Semantic Context is Hi Core context capability, not an OpenCode-native host capability. The current explicit adapter surface contains only `TypeScriptSemanticContextAdapter` for `.ts`/`.tsx` (`typescript`, `typescriptreact`). No LSP semantic adapter, Tree-sitter adapter, or JavaScript adapter is currently claimed. A future host-backed semantic adapter must be added behind `SemanticContextAdapter` and separately proven before documentation may advertise it.

## Process lifecycle capability boundary

`ProcessContract` is the Hi Core semantic contract and P2 wires a Hi `ProcessExecutor` instance through runtime services using `OpenCodePtyAdapter`. The adapter uses OpenCode's canonical v2 PTY create/get/remove/connect-token surface plus the ticketed WebSocket protocol for stdin and cursor-bounded output. Spawn is fail-closed against the effective OpenCode role permission map: explicit `deny` is denied, `ask` remains user-action-required and is never auto-promoted, external cwd requires explicit `external_directory` allow, and classified external side effects require a matching Hi `ExternalAction`/authority reference. Kill validates the observed PID before signalling; cleanup is a distinct terminal-state operation and cannot masquerade as kill. `process-lifecycle` still remains `DEGRADED` because P3 must bind WAIT/STOP/restart/orphan reconciliation and produce exact T3 host receipts before support can be claimed.
