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

`scripts/native_plugin_setup.py` provides ownership-aware `plan`, `install`, `upgrade`, `doctor`, `reconfigure`, `role-models`, `uninstall`, `rollback`, and `recover` helpers. Install is idempotent once Hi owns the exact registration. Upgrade requires the active `setup.json` ownership proof and exact current owned plugin spec; it never treats an arbitrary existing Hi registration as upgrade authority. Setup registration mutations use same-directory atomic config replacement plus a bounded transaction journal. A successful mutation publishes exactly one rollback point; `rollback` restores the prior Hi registration/ownership only while the post-operation config hash is unchanged, so later user edits fail closed instead of being overwritten. `recover` reconciles an interrupted planned/config-applied/ownership-applied setup transaction only when the current config matches a recorded before/after state. It preserves unrelated user plugin/MCP/config state. `doctor` reports pending transaction and rollback availability; real OpenCode plugin/agent/skill/model loading remains a separate runtime receipt.

## Filesystem hygiene

Project-local registration may create or modify `opencode.json` when required by OpenCode. Hi-owned durable project data uses the capability-derived `.opencode/hi/` namespace; OpenCode-native plugin/skill/agent/command/tool directories remain owned by OpenCode. Package source is not unpacked into the repository root. See `docs/FILESYSTEM-LAYOUT.md` and `docs/STORAGE-ARCHITECTURE.md`.


### Setup lifecycle state

The setup owner uses `.opencode/hi/provenance/setup.json` for active registration ownership, `.opencode/hi/provenance/setup-transaction.json` only while an install/upgrade/uninstall transaction needs crash recovery, and `.opencode/hi/provenance/setup-rollback.json` as one bounded rollback point. State files are written with restrictive permissions on POSIX. They contain registration identity, hashes, indexes, operation state, and setup ownership metadata only; they do **not** copy the `opencode.json` body, MCP configuration, credentials, or unrelated project configuration. Normal completion removes the transaction journal. A later setup mutation replaces the single rollback point. Uninstall removes active `setup.json` but retains the bounded rollback point so the just-completed uninstall can be reversed; independent project policy/knowledge/artifacts remain untouched.
