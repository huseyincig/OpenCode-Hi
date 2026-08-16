# Installation, Configuration and Lifecycle

OpenCode-Hi's canonical package name is `opencode-hi`. Installation truth has two separate layers:

1. **registration/lifecycle mechanics** — implemented and deterministically verified by `scripts/native_plugin_setup.py`;
2. **registry distribution availability** — `opencode-hi@0.1.1` is published on npm and T4-verified through Trusted Publishing OIDC provenance plus fresh-registry exact-host acceptance.

Local registration tests and public-registry availability remain separate evidence layers; the current release has both.

## Prerequisites

- a supported OpenCode host for the path being tested;
- Python 3 for the setup CLI (the packed package exposes it as `opencode-hi-setup`; a source checkout may invoke the same script directly);
- Node/npm only when building from source;
- a project directory whose unrelated OpenCode/user configuration must be preserved.

Current exact host support belongs to `data/validation/compatibility-matrix-0.1.0.json` and [Host Support](HOSTS.md).

## Package registration

For the current public release, OpenCode package configuration uses the exact package spec:

```json
{
  "plugin": ["opencode-hi@0.1.1"]
}
```

The setup CLI can plan and apply that registration without replacing unrelated configuration. The publishable package includes `scripts/native_plugin_setup.py`, `VERSION`, and the executable npm bin `opencode-hi-setup`; this avoids requiring a repository checkout once a registry package exists. From a source checkout:

```bash
python3 scripts/native_plugin_setup.py plan /path/to/project --version <version>
python3 scripts/native_plugin_setup.py install /path/to/project --version <version>
python3 scripts/native_plugin_setup.py doctor /path/to/project
```

The npm package exposes the same lifecycle as `opencode-hi-setup`. A fresh registry consumer has installed `opencode-hi@0.1.1` and loaded it on exact OpenCode `1.18.18`; this is current T4 evidence rather than a package-content-only claim.

`plan` is non-mutating. `install` is idempotent after Hi owns the exact registration. `doctor` validates registration/ownership/lifecycle state; it explicitly does **not** substitute for a real OpenCode runtime-load check.

For a local install, `./node_modules/.bin/opencode-hi-setup` can be used directly; source-checkout invocations below remain the development equivalent.

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

Configuration precedence is resolved **per leaf**, not per object block: `default -> host Hi config -> explicit valid project routing leaf`. A project block that omits or supplies an invalid sibling leaf cannot erase a valid host value. Constraint collections compose monotonically where required: provider allowlists narrow by intersection and denied-model lists accumulate by union. Unknown keys are ignored rather than admitted to canonical `HiConfig`.

## Configuration reference

<!-- BEGIN GENERATED CONFIG REFERENCE -->
Generated from `data/hi-config-options.json`. Do not hand-edit this table.

| Path | Class | Default | Safety | Executable/diagnostic effect |
|---|---|---|---|---|
| `schemaVersion` | schema-marker | `2` | constraint | reports noncanonical supplied schema while runtime remains current-only |
| `executionPolicy` | runtime | `adaptive` | preference | selects minimal/balanced/thorough routing profile and automatic/adaptive continuation behavior |
| `primaryMode` | runtime | `auto` | preference | selects/forces primary agent and direct-vs-delegated minimum-team behavior |
| `compatibility.mode` | diagnostic | `compatible` | constraint | changes unsupported/unvalidated host compatibility findings from warning to failure under strict mode |
| `compatibility.validatedOpenCodeVersions` | diagnostic | `[]` | constraint | matches observed OpenCode version against the validated-version inventory |
| `execution.topology` | runtime | `adaptive` | constraint | forces/adapts single-agent versus multi-agent mission topology |
| `execution.maxAgents` | runtime | `4` | capacity | caps topology agent count; value 1 is an executable single-agent ceiling |
| `execution.parallelism` | runtime | `2` | capacity | caps parallel streams inside selected mission topology |
| `models.mode` | runtime | `adaptive` | preference | switches adaptive scoring versus fixed or role-mapped model preference |
| `models.default` | runtime | `auto` | preference | provides fixed project model when models.mode=fixed |
| `models.roles` | runtime | `{}` | preference | provides project role-specific model when models.mode=role-mapped |
| `routing.strategy` | runtime | `cost-quality` | preference | changes model scoring between quality, cost, and cost-quality |
| `routing.categoryModels` | runtime | `{}` | preference | prepends configured category candidates before scored models |
| `routing.categoryVariants` | runtime | `{}` | preference | changes selected native model variant by task category |
| `routing.roleModels` | runtime | `{}` | preference | prepends configured role candidates before category/scored models |
| `routing.roleVariants` | runtime | `{}` | preference | changes selected native variant for a specific role/model pair |
| `routing.maxFallbacks` | runtime | `3` | capacity | bounds fallback candidate count |
| `routing.allowedProviders` | runtime | `[]` | constraint | narrows eligible providers and disables unconstrained host-default fallback when nonempty |
| `routing.deniedModels` | runtime | `[]` | constraint | denies exact models and composes project/raw denies monotonically |
| `parallel.enabled` | runtime | `true` | capacity | sets global scheduler capacity to one when disabled |
| `parallel.max` | runtime | `3` | capacity | caps total concurrently acquired workers |
| `parallel.providers` | runtime | `{}` | capacity | caps concurrent workers per provider |
| `parallel.models` | runtime | `{}` | capacity | caps concurrent workers per model |
| `teamMode.enabled` | runtime | `false` | constraint | enables Team Mode tools only when host worker-runtime is supported and permits team creation |
| `teamMode.maxMembers` | runtime | `4` | capacity | caps distinct Team Mode members |
| `teamMode.maxWallMinutes` | runtime | `45` | capacity | sets team expiry deadline and terminal expiration gate |
| `profile.minimal.specialistThreshold` | runtime | `high` | preference | changes specialist dispatch threshold for the selected execution profile |
| `profile.minimal.reviewThreshold` | runtime | `low` | preference | changes reviewer dispatch threshold for the selected execution profile |
| `profile.balanced.specialistThreshold` | runtime | `medium` | preference | changes specialist dispatch threshold for the selected execution profile |
| `profile.balanced.reviewThreshold` | runtime | `medium` | preference | changes reviewer dispatch threshold for the selected execution profile |
| `profile.thorough.specialistThreshold` | runtime | `low` | preference | changes specialist dispatch threshold for the selected execution profile |
| `profile.thorough.reviewThreshold` | runtime | `high` | preference | changes reviewer dispatch threshold for the selected execution profile |
<!-- END GENERATED CONFIG REFERENCE -->

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
