# Installation, Configuration and Lifecycle

OpenCode-Hi's canonical package name is `opencode-hi`. Installation truth has separate distribution and host-loading layers:

After the plugin loads, use the complete [Configuration Guide](CONFIGURATION.md) for Windows/Linux/macOS project paths, all supported runtime settings, role/model/fallback routing, variants, provider/model policy, concurrency, CLI/manual configuration, and troubleshooting.

Türkçe kullanıcı rehberi: [Türkçe Kurulum ve Yapılandırma Rehberi](locales/tr/CONFIGURATION.md).

1. **npm registry distribution — normal user path** — the package runner performs a one-shot registration/update without a repository checkout or project-root package installation;
2. **OpenCode native loading** — OpenCode owns package cache/materialization and plugin execution after restart;
3. **Hi lifecycle ownership** — Hi owns only its exact plugin registration plus `.opencode/hi/**` provenance/policy state; unrelated OpenCode/user configuration stays user/host-owned;
4. **Git/source distribution — contributor path** — direct Git/local loading remains a development and CI compatibility surface, not the default onboarding path.

## Prerequisites

Normal users need:

- a supported OpenCode host;
- Node/npm with `npx` available;
- registry/network access for the selected `opencode-hi` release;
- a project directory whose unrelated OpenCode/user configuration must be preserved.

If a task requires Hi-owned workspace isolation on OpenCode 1.18.19, enable that host primitive **before starting OpenCode** with `OPENCODE_EXPERIMENTAL_WORKSPACES=true`. OpenCode also treats `OPENCODE_EXPERIMENTAL=true` as the fallback when the workspace-specific variable is unset; an explicit workspace-specific false value overrides the broad flag. Hi otherwise remains usable, but reports workspace isolation unavailable and fails isolation preflight closed instead of creating an unmanaged worktree.

Normal setup does **not** require Git checkout, Bun, an external Python installation, a project `package.json`, or project-root `node_modules`. Python is only needed for the retained legacy/advanced helper commands that are explicitly documented as such below.

Current candidate compatibility targets exact OpenCode `1.18.19`. Historical T3 capability receipts remain provenance for the host versions they actually measured; current release-gate status belongs to [Release Engineering](RELEASE.md) and [Host Support](HOSTS.md).

## npm package runner — normal user path

For release `0.2.2`, register the exact package without installing it into the application project:

```bash
npx --yes opencode-hi@0.2.2 setup /path/to/project
```

`setup` preserves foreign plugins, providers, MCP configuration, themes and unknown user fields. It writes one exact `opencode-hi@0.2.2` plugin entry plus Hi-owned provenance under `.opencode/hi/provenance/**`. It does not create an application-root `package.json`, `package-lock.json`, or `node_modules`.

If the project uses only `opencode.jsonc`, setup fails closed instead of rewriting comments. Maintain an `opencode.json` registration explicitly or convert the configuration deliberately; Hi does not silently rewrite JSONC.

Restart OpenCode after setup. OpenCode then owns registry package cache/materialization and plugin loading. OpenCode 1.18.19 may create host-owned `.opencode/.gitignore`, `.opencode/package.json`, or `.opencode/node_modules` while preparing its plugin runtime; these are **not** Hi-owned bootstrap files and must not be treated as Hi lifecycle state.

After restart:

```bash
npx --yes opencode-hi@0.2.2 doctor /path/to/project
```

Package `doctor` checks registration, ownership, drift and pending lifecycle state. It deliberately does not claim provider authentication, successful model calls, or live runtime capability. Run the loaded in-runtime `hi_doctor` tool for effective provider/model inventory and runtime capability truth.

The source tree can describe `0.2.2` before publication, but public-registry availability is not considered proven until npm Trusted Publishing plus fresh-registry/exact-host receipts exist.

## Command reference and interaction model

The npm package runner owns installation lifecycle only. Its canonical commands are:

| Command | Mutation | What it does |
|---|---:|---|
| `setup` | yes | creates the first exact Hi-owned registration and ownership provenance |
| `update` | yes | changes an existing Hi-owned registration to the requested exact release |
| `doctor` | no | checks registration, ownership, config-hash drift, routing schema and pending lifecycle state |
| `plan` | no | returns the exact before/after registration plan and blocks conflicts |
| `rollback` | yes | restores one recorded lifecycle point only when current hashes still match |
| `recover` | bounded | reconciles only a recorded interrupted setup/update transaction |

`install` is an alias of `setup`; `upgrade` is an alias of `update`. The documented normal path stays `setup` / `update`.

The loaded plugin is a different surface. Exact OpenCode 1.18.19 acceptance observes 31 runtime tools:

- diagnostics/state: `hi_doctor`, `hi_status`, `hi_readiness`, `hi_metrics`, `hi_ledger`;
- semantic/control: `hi_intent_assess`, `hi_direct_progress`;
- context and reversible mutation: `hi_context_artifact_add`, `hi_context_artifacts`, `hi_temporary_mutation_register`, `hi_temporary_mutation_revert`;
- bounded task/worker control: `hi_task_start`, `hi_task_await`, `hi_task_peek`, `hi_task_list`, `hi_task_cancel`;
- bounded process control: `hi_process_spawn`, `hi_process_read`, `hi_process_write`, `hi_process_wait`, `hi_process_kill`, `hi_process_cleanup`, `hi_process_list`;
- bounded browser control: `hi_browser_open`, `hi_browser_navigate`, `hi_browser_click`, `hi_browser_type`, `hi_browser_inspect`, `hi_browser_screenshot`, `hi_browser_wait`, `hi_browser_close`.

There is no current `hi_state`, `hi_rotate`, or `hi_reprofile` tool. Live Mission state belongs to `hi_status` / `hi_readiness` / `hi_ledger`; installation ownership state belongs to package `doctor`.

### Is setup fully interactive?

No. The current normal-user setup is deterministic and non-interactive by design:

```text
setup -> restart OpenCode -> package doctor -> runtime hi_doctor
```

It does not present a wizard for provider/model/profile choices. Provider authentication and provider configuration remain OpenCode-owned. Hi consumes OpenCode's structured runtime provider state after the host loads, intersects it with `connected` provider IDs when available, then capability-filters and ranks child models. Initial child-role recommendations are generated once from that effective inventory; valid user routing is preserved thereafter.

Advanced/manual changes such as execution policy, routing strategy, concurrency and explicit role-model mappings are available through the retained Python `reconfigure` / `role-models` helper below. They are not required for normal npm installation.

## Git/source path — contributor and CI compatibility

Direct Git or local plugin loading remains supported for development/CI. Use an exact repository SHA/spec for reproducible acceptance and verify that the host actually loads the plugin. Unpinned Git source is not a release identity and is no longer the normal-user installation recommendation.

## Development/source loading

For repository development:

```bash
npm ci --prefix plugin
npm run build:plugin
```

OpenCode supports project-local plugin files under `.opencode/plugins/` and local/file plugin loading. A runtime acceptance check must observe the built plugin actually loading, not merely a configuration file containing its path/spec.

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
| `models.roles` | runtime | `{}` | preference | provides project child-role-specific model when models.mode=role-mapped; primary manager models remain OpenCode-owned |
| `routing.strategy` | runtime | `cost-quality` | preference | changes model scoring between quality, cost, and cost-quality |
| `routing.categoryModels` | runtime | `{}` | preference | prepends configured category candidates before scored models |
| `routing.categoryVariants` | runtime | `{}` | preference | changes selected native model variant by task category |
| `routing.roleModels` | runtime | `{}` | preference | prepends configured child-role candidates before category/scored models; primary manager roles are excluded |
| `routing.roleVariants` | runtime | `{}` | preference | changes selected native variant for a specific child-role/model pair; primary manager roles are excluded |
| `routing.maxFallbacks` | runtime | `3` | capacity | bounds fallback candidate count |
| `routing.allowedProviders` | runtime | `[]` | constraint | narrows eligible providers and disables unconstrained host-default fallback when nonempty |
| `routing.deniedModels` | runtime | `[]` | constraint | denies exact models and composes project/raw denies monotonically |
| `parallel.enabled` | runtime | `true` | capacity | sets global scheduler capacity to one when disabled |
| `parallel.max` | runtime | `3` | capacity | caps total concurrently acquired workers |
| `parallel.providers` | runtime | `{}` | capacity | caps concurrent workers per provider |
| `parallel.models` | runtime | `{}` | capacity | caps concurrent workers per model |
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

The command supports explicit model/fallback/variant mappings for the six Hi child roles only: `coder`, `architect`, `repository-explorer`, `qa-reviewer`, `security-reviewer`, and `visual-qa`. `manager` and `working-manager` remain primary OpenCode roles and are not valid Hi role-model targets; their primary model is selected through OpenCode. Role remains distinct from model; configuring one does not merge their semantic ownership.

For OpenCode `1.18.19`, Hi's runtime inventory comes from OpenCode's structured provider state and is intersected with the host's `connected` provider IDs when that field is exposed. OpenCode has already applied `enabled_providers`, `disabled_providers`, provider `whitelist`/`blacklist`, alpha/deprecated filtering and runtime provider overrides before Hi ranks child models. Hi does not scrape the full models.dev catalog and does not fabricate an offline model list when the host inventory is unavailable.

OpenCode `1.18.19` does **not** have a model-level `disabled: true` picker filter; model filtering for this host version is provider `whitelist` / `blacklist`. Do not copy newer-schema `model.disabled` examples into a 1.18.19 configuration.

Hi does not ship a fixed provider/model recommendation. On the first effective OpenCode runtime inventory, it filters to enabled/policy-allowed models, applies hard role capability requirements, and uses the canonical cost/quality scorer to choose a one-shot initial recommendation for each eligible child role. The selected IDs therefore depend on the models you actually enabled. `visual-qa` additionally requires an explicit host-reported image-input capability; a text-only model or unverified `host-default` is rejected before ranking and again before dispatch. Once the generated routing file exists, those role choices are user-editable preferences and later update/inventory refresh does not overwrite them.

There is no arbitrary eight-model cap in current routing or doctor output. A model appearing in OpenCode's runtime inventory means it passed the host's configuration/inventory construction; it does **not** by itself prove credentials or a successful remote inference call.

## Update

Update requires active Hi setup ownership and the exact currently owned package spec. Run the target release's package runner; for `0.2.2`:

```bash
npx --yes opencode-hi@0.2.2 update /path/to/project
```

The command preserves foreign plugins, providers, MCP configuration, themes and unknown user fields. It does not treat an arbitrary pre-existing `opencode-hi` entry as permission to rewrite it, and it refuses owned-config drift rather than overwriting user changes.

## Uninstall — legacy/advanced helper

Uninstall is not part of the M16 normal-user three-command surface. When explicit removal is required, the retained Python helper remains available from a source checkout or Python-capable package environment:

```bash
python3 scripts/native_plugin_setup.py uninstall /path/to/project
```

Uninstall removes only the registration/state owned by the setup lifecycle. Independently owned Hi project data such as policy, project methodology-learning candidates, artifacts or OpenCode-native project skills is not deleted merely because the plugin registration is removed.

## One-step rollback

Each successful setup/update mutation leaves one bounded rollback point:

```bash
npx --yes opencode-hi@0.2.2 rollback /path/to/project
```

Rollback applies only while the post-operation configuration still matches the recorded hash. If the user changed the configuration afterward, rollback fails closed instead of overwriting that work. A fresh-install rollback restores prior configuration-file absence when the file did not exist before installation.

## Crash recovery

A pending setup/update transaction blocks new lifecycle mutation until it is reconciled:

```bash
npx --yes opencode-hi@0.2.2 recover /path/to/project
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

Package source is not supposed to be unpacked into arbitrary project-root product directories. Hi-owned durable project data lives under `.opencode/hi/`; OpenCode-native plugin/skill directories remain host-owned. See [Architecture](ARCHITECTURE.md#storage-and-filesystem-ownership).

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
