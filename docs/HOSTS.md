# Host Boundary

OpenCode is the reference host for 0.1.x. Core mission, evidence, authority, completion, execution policy, context policy, topology, failure, and human-decision semantics do not require OpenCode SDK types.

A capability manifest resolves host features as `NATIVE`, `SAFE_EMULATION`, `DEGRADED`, or `UNSUPPORTED`; compatibility is never faked. On the current OpenCode adapter, `process_events` is `DEGRADED` and `workspace_isolation` is `UNSUPPORTED`; local helper code is not treated as equivalent host execution. Future Codex, Claude Code, Cursor, or MCP adapters may be added at the semantic boundary without replacing OpenCode-native behavior.


## Role boundary

Hi Core role identity and authority live in `plugin/src/runtime/roles/catalog.ts`: the canonical primary/child role family, read-only/reviewer classes, and child obligation ownership are host-independent product semantics.

`roles/*.md` are OpenCode reference-host adapter templates. Their frontmatter expresses OpenCode-native agent mode and permissions, and `scripts/generate_plugin_agents.py` derives the packaged OpenCode agent definitions. A future host adapter may bind the same Hi Core roles to different native primitives without changing Core role ownership.
