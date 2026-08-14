# Host Boundary

OpenCode is the reference host for 0.1.x. Core mission, evidence, authority, completion, execution policy, context policy, topology, failure, and human-decision semantics do not require OpenCode SDK types.

A capability manifest resolves host features as `NATIVE`, `SAFE_EMULATION`, `DEGRADED`, or `UNSUPPORTED`; compatibility is never faked. The latest completed exact-host acceptance is OpenCode 1.18.18. The host SDK exposes a separate PTY lifecycle and workspace/session `workspaceID` primitives, but those primitives are not equivalent to current Hi product ownership. Ordinary model-facing bash still has no Hi-owned PID/job wait/kill/exit lifecycle, so `process_events` remains `DEGRADED`. Hi has no canonical isolation selection/provisioning/cleanup executor or real-host proof that child tool execution is bound to an alternate workspace, so `workspace_isolation` remains `UNSUPPORTED`. MCP/tool discovery likewise does not provide a deterministic browser-evidence executor, so `browser-execution` remains `UNSUPPORTED`. Doctor reports all three limitations. Future adapters may add support only with an owned executor and acceptance proof.


## Role boundary

Hi Core role identity and authority live in `plugin/src/runtime/roles/catalog.ts`: the canonical primary/child role family, read-only/reviewer classes, and child obligation ownership are host-independent product semantics.

`roles/*.md` are OpenCode reference-host adapter templates. Their frontmatter expresses OpenCode-native agent mode and permissions, and `scripts/generate_plugin_agents.py` derives the packaged OpenCode agent definitions. A future host adapter may bind the same Hi Core roles to different native primitives without changing Core role ownership.
