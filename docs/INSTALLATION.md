# Installation, Configuration and Lifecycle

OpenCode-Hi's canonical package name is `opencode-hi`. Installation truth has two separate layers:

1. **registration/lifecycle mechanics** — implemented and deterministically verified by `scripts/native_plugin_setup.py`;
2. **registry distribution availability** — currently blocked because `opencode-hi@0.1.0` has not yet been bootstrap-published to npm.

A successful local registration test must not be presented as proof that a fresh user can download the package from npm today.

## Prerequisites

- a supported OpenCode host for the path being tested;
- Python 3 for the repository setup helper;
- Node/npm only when building from source;
- a project directory whose unrelated OpenCode/user configuration must be preserved.

Current exact host support belongs to `data/validation/compatibility-matrix-0.1.0.json` and [Host Support](HOSTS.md).

## Package registration

When a registry package version is actually available, OpenCode package configuration uses an exact package spec such as:

```json
{
  "plugin": ["opencode-hi@<version>"]
}
```

The repository setup helper can plan and apply that registration without replacing unrelated configuration:

```bash
python3 scripts/native_plugin_setup.py plan /path/to/project --version <version>
python3 scripts/native_plugin_setup.py install /path/to/project --version <version>
python3 scripts/native_plugin_setup.py doctor /path/to/project
```

`plan` is non-mutating. `install` is idempotent after Hi owns the exact registration. `doctor` validates registration/ownership/lifecycle state; it explicitly does **not** substitute for a real OpenCode runtime-load check.

At the current release state, npm bootstrap is blocked, so the example above describes the verified registration contract rather than an available public npm download path.

## Development/source loading

For repository development:

```bash
npm ci --prefix plugin
npm run build
```

OpenCode supports project-local plugin files under `.opencode/plugins/` and local/file plugin loading. Use the exact host-supported local plugin mechanism when testing source builds. Do not use an arbitrary Git URL as if it were a guaranteed npm package specifier.

A runtime acceptance check must observe the built plugin actually loading, not merely a configuration file containing its path/spec.

## Reconfigure

The setup helper exposes bounded current configuration options through `reconfigure`:

```bash
python3 scripts/native_plugin_setup.py reconfigure /path/to/project   --execution-policy adaptive   --primary-mode auto   --routing-strategy cost-quality
```

Additional bounded options include provider/model allow/deny rules, fallback limits, parallel/provider/model concurrency limits, profile thresholds and Team controls. The canonical complete option inventory is `data/hi-config-options.json`; documentation must not become a second mechanical config catalog.

Safety constraints are monotonic: a lower-precedence option cannot silently widen canonical Authority/Permission restrictions.

## Role/model configuration

Role/model routing can be inspected or changed through the dedicated command:

```bash
python3 scripts/native_plugin_setup.py role-models /path/to/project --print
python3 scripts/native_plugin_setup.py role-models /path/to/project --list-available
```

The command also supports explicit role/model/variant mappings and bounded policy modes. Role remains distinct from model; configuring one does not merge their semantic ownership.

## Upgrade

Upgrade requires active Hi setup ownership and the exact currently owned package spec:

```bash
python3 scripts/native_plugin_setup.py upgrade /path/to/project --version <new-version>
```

The helper preserves foreign plugins, MCP configuration, themes and unknown user fields. It does not treat an arbitrary pre-existing `opencode-hi` entry as permission to rewrite it.

## Uninstall

```bash
python3 scripts/native_plugin_setup.py uninstall /path/to/project
```

Uninstall removes only the registration/state owned by the setup lifecycle. Independently owned Hi project data such as policy, Project Intelligence, artifacts or OpenCode-native project skills is not deleted merely because the plugin registration is removed.

## One-step rollback

Each successful setup mutation leaves one bounded rollback point:

```bash
python3 scripts/native_plugin_setup.py rollback /path/to/project
```

Rollback applies only while the post-operation configuration still matches the recorded hash. If the user changed the configuration afterward, rollback fails closed instead of overwriting that work. A fresh-install rollback restores prior configuration-file absence when the file did not exist before installation.

## Crash recovery

A pending install/upgrade/uninstall transaction blocks new setup mutation until it is reconciled:

```bash
python3 scripts/native_plugin_setup.py recover /path/to/project
```

Recovery completes/discards only a recorded before/after state it can prove. Ambiguous drift is blocked.

## Setup state and permissions

The setup owner uses:

```text
.opencode/hi/provenance/setup.json
.opencode/hi/provenance/setup-transaction.json
.opencode/hi/provenance/setup-rollback.json
```

`setup-transaction.json` exists only while crash recovery may be needed. State records registration identity, hashes, indexes, operation state and ownership metadata; they do **not** copy the full `opencode.json`, MCP configuration, credentials or unrelated project configuration. POSIX state files use restrictive permissions.

## Project filesystem ownership

Package source is not supposed to be unpacked into arbitrary project-root product directories. Hi-owned durable project data lives under `.opencode/hi/`; OpenCode-native plugin/skill directories remain host-owned. See [Filesystem Layout](FILESYSTEM-LAYOUT.md) and [Storage Architecture](STORAGE-ARCHITECTURE.md).

## After configuration changes

Restart OpenCode when the host does not hot-reload plugin configuration. Then verify the actual runtime surface—plugin initialization, canonical Hi agents/tools/skills and relevant host capability behavior. Static `doctor` success is necessary lifecycle evidence, not real-host T3 proof.

## Failure model

Setup errors are fail-closed:

- conflicting/foreign ownership is not silently adopted;
- a pending transaction blocks new mutation;
- post-operation user drift blocks rollback;
- interrupted state is recovered only from exact recorded hashes;
- unrelated OpenCode/user configuration is preserved.

The replayable local lifecycle receipt is `data/validation/install-lifecycle-0.1.0.json`.
