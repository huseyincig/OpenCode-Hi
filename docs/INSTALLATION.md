# Installation

OpenCode-Hi is packaged as the npm package `opencode-hi` and exposes its OpenCode plugin entrypoint from the package root.

For a project-local installation, register the package in `<project-root>/opencode.json` while preserving unrelated configuration:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-hi"]
}
```

OpenCode installs package plugins and their production dependencies into its own cache. OpenCode-Hi therefore does not unpack product source into the project root. Restart OpenCode after changing a package version when the host does not reload that dependency automatically.

For local development before npm publication, use OpenCode's supported local-plugin loading mechanism rather than treating a Git URL as a guaranteed npm package specifier. Project-local plugin files belong under `.opencode/plugins/`; local package/path loading must follow the OpenCode version being tested.

`scripts/native_plugin_setup.py` provides ownership-aware `plan`, `install`, `doctor`, `reconfigure`, `role-models`, and `uninstall` helpers. It preserves unrelated user plugin/MCP/config state. `doctor` is a static registration/ownership check; real OpenCode plugin/agent/skill/model loading requires a runtime receipt.

## Filesystem hygiene

Project-local registration may create or modify `opencode.json` when required by OpenCode. Hi-owned durable project data uses the capability-derived `.opencode/hi/` namespace; OpenCode-native plugin/skill/agent/command/tool directories remain owned by OpenCode. Package source is not unpacked into the repository root. See `docs/FILESYSTEM-LAYOUT.md` and `docs/STORAGE-ARCHITECTURE.md`.
