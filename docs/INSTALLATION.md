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

If a task requires Hi-owned workspace isolation on OpenCode 1.18.21, enable that host primitive **before starting OpenCode** with `OPENCODE_EXPERIMENTAL_WORKSPACES=true`. OpenCode also treats `OPENCODE_EXPERIMENTAL=true` as the fallback when the workspace-specific variable is unset; an explicit workspace-specific false value overrides the broad flag. Hi otherwise remains usable, but reports workspace isolation unavailable and fails isolation preflight closed instead of creating an unmanaged worktree.

Normal setup does **not** require Git checkout, Bun, an external Python installation, a project `package.json`, or project-root `node_modules`. Python is only needed for the retained legacy/advanced helper commands that are explicitly documented as such below.

For published `0.2.4`, mandatory Hi-owned local browser verification also has a bounded first-use recovery path: if no usable Chromium executable is observed, Hi may invoke the package's pinned optional `playwright-core@1.62.1` CLI once to install Chromium into a Hi-owned cache (`HI_BROWSER_CACHE`, otherwise the platform cache root). It never installs browser files into the application project. A timeout, missing runtime package/CLI, network/install failure, or still-missing executable is recorded as unavailable environment/capability state and is not retried indefinitely on unchanged state.

Current published compatibility target is exact OpenCode `1.18.21`. Historical and still-current full-T3 capability receipts remain provenance for the host versions they actually measured; do not reinterpret an older 1.18.19 receipt as 1.18.21 evidence. Current release-gate status belongs to [Release Engineering](RELEASE.md) and [Host Support](HOSTS.md).

## npm package runner — normal user path

For release `0.2.2`, register the exact package without installing it as an npm dependency of the application project. The shortest first-install form is:

```bash
cd /path/to/project
npx --yes opencode-hi@0.2.2 install .
```

In published `0.2.3`, `install` is the friendly first-install alias of `setup`. In published `0.2.4`, `install` becomes the safe **ensure** command: it performs first setup when no Hi ownership exists, returns `NOOP` at the same exact owned version, and delegates to the same ownership/drift-guarded update path for an older Hi-owned registration. `setup` remains strict first-install. These commands preserve foreign plugins, providers, MCP configuration, themes and unknown user fields. It creates or preserves the project-root `opencode.json` and writes one exact target `opencode-hi@<version>` plugin entry plus Hi-owned provenance under `.opencode/hi/provenance/**`. It does not create an application-root `package.json`, `package-lock.json`, or persistent root `node_modules`.

Do **not** substitute `npm i opencode-hi` for this command. Plain `npm i` is npm dependency installation: it creates/updates project npm state (`package.json`, `package-lock.json`, `node_modules`) and does not perform Hi's OpenCode registration/provenance setup.

The equivalent explicit `setup` spelling is also supported and documented:

```bash
npx --yes opencode-hi@0.2.2 setup /path/to/project
```

If the project uses only `opencode.jsonc`, setup fails closed instead of rewriting comments. Maintain an `opencode.json` registration explicitly or convert the configuration deliberately; Hi does not silently rewrite JSONC.

Restart OpenCode after setup. OpenCode then owns registry package cache/materialization and plugin loading. OpenCode 1.18.19 may create host-owned `.opencode/.gitignore`, `.opencode/package.json`, or `.opencode/node_modules` while preparing its plugin runtime; these are **not** Hi-owned bootstrap files and must not be treated as Hi lifecycle state.

After restart:

```bash
npx --yes opencode-hi@0.2.2 doctor /path/to/project
```

Package `doctor` checks registration, ownership, drift and pending lifecycle state. It deliberately does not claim provider authentication, successful model calls, or live runtime capability. Run the loaded in-runtime `hi_doctor` tool for effective provider/model inventory and runtime capability truth.

Release `0.2.3` is published and its npm Trusted Publishing plus fresh-registry exact OpenCode `1.18.19` verification is complete.

## Command reference and interaction model

The npm package runner owns installation lifecycle only. Its canonical commands are:

| Command | Mutation | What it does |
|---|---:|---|
| `install` | bounded | published `0.2.4`: ensures exact registration through setup / safe owned update / NOOP |
| `setup` | yes | strict first exact Hi-owned registration; published `0.2.4` also opens the bounded wizard on a real terminal |
| `update` | yes | explicitly changes an existing Hi-owned registration to the requested exact release |
| `doctor` | no | checks registration, ownership, config-hash drift, routing schema and pending lifecycle state |
| `reconfigure` | routing only | published `0.2.4`: reopen the bounded terminal project wizard |
| `state` | no | shows package/registration/routing state without claiming live Mission/provider truth |
| `reprofile` | yes | changes only project-owned `executionPolicy` |
| `roles` | bounded | prints or explicitly edits child-role model/fallback/variant mappings |
| `rotate` | yes | rotates one child role's configured model fallback order only |
| `check-update` | no | reads npm registry latest metadata and reports an update advisory |
| `plan` | no | returns the exact before/after registration plan and blocks conflicts |
| `rollback` | yes | restores one recorded lifecycle point only when current hashes still match |
| `recover` | bounded | reconciles only a recorded interrupted setup/update transaction |

Published `0.2.4` gives `install` ensure semantics while keeping `setup` strict; `upgrade` remains an `update` alias.

### Current `dev` settings flow

After the published `0.2.4` baseline, current development adds unified settings while preserving OpenCode ownership boundaries. Use runtime `hi_settings` when live connected-model validation matters; use `npx opencode-hi config` for deterministic project preference inspection/change. Work Mode is `Adaptive`, `Single`, or `Multi`; it is separate from the primary Manager/Working Manager behavior and from advanced effort/profile policy. A runtime multi-field update is validated completely before `.opencode/hi/policy/routing.json` is replaced, so an unavailable model or non-vision `visual-qa` selection cannot leave a partially changed mode/role configuration. Successful runtime changes apply to new worker dispatches without restart. When no explicit settings file exists, the first pending chat session receives one bounded setup hint if live models are already available; a material task is never blocked by that hint and uses Adaptive + Automatic defaults. Opening `hi_settings` performs an explicit inventory refresh, so newly connected providers can appear without relying on a host event that OpenCode 1.18.21 does not expose.

The published `0.2.4` exact-host evidence below remains immutable and therefore still observes 34 tools; current `dev` additionally exposes `hi_settings`.

The loaded plugin is a different surface. Exact OpenCode 1.18.21 acceptance observes 34 runtime tools:

- diagnostics/state: `hi_doctor`, `hi_status`, `hi_readiness`, `hi_metrics`, `hi_ledger`;
- semantic/control: `hi_intent_assess`, `hi_direct_progress`;
- context and reversible mutation: `hi_context_artifact_add`, `hi_context_artifacts`, `hi_temporary_mutation_register`, `hi_temporary_mutation_revert`;
- bounded task/worker control: `hi_task_start`, `hi_task_await`, `hi_task_peek`, `hi_task_list`, `hi_task_cancel`;
- bounded process control: `hi_process_spawn`, `hi_process_read`, `hi_process_write`, `hi_process_wait`, `hi_process_kill`, `hi_process_cleanup`, `hi_process_list`;
- bounded browser control: `hi_browser_preview_open`, `hi_browser_open`, `hi_browser_navigate`, `hi_browser_click`, `hi_browser_type`, `hi_browser_key`, `hi_browser_inspect`, `hi_browser_screenshot`, `hi_browser_wait`, `hi_browser_close`.

For published `0.2.4`, package `doctor` reports installation ownership/drift state; runtime `hi_status`, `hi_readiness`, and `hi_ledger` report live Mission state. Published `0.2.4` also exposes the Node-native package controls below for common profile/model-routing changes while keeping live Mission/provider truth in the loaded runtime.

### Is setup interactive?

Published `0.2.4` is interactive **only when the package runner is attached to a real terminal**. CI and piped/non-TTY automation remain deterministic; `--non-interactive` makes that choice explicit. The wizard is intentionally bounded and does not own provider authentication or pretend that model IDs are live before OpenCode exposes the runtime inventory.

```text
setup/install (TTY) -> choose primary mode -> restart -> type “Hi rol modellerini ayarla” in chat -> runtime hi_doctor
setup/install (non-TTY) -> deterministic registration -> restart -> package doctor -> runtime hi_doctor
```

The normal-user wizard writes only `primaryMode`. Task topology, execution depth, specialist thresholds, and parallelism remain Hi runtime internals. After restart, type **“Hi rol modellerini ayarla”** in OpenCode chat: `hi_role_models` lists the effective connected runtime inventory and persists only explicit ordered child-role model/fallback choices. Without an explicit Hi mapping, the OpenCode agent model is used when configured; otherwise Hi makes an ephemeral capability/variant recommendation from the live inventory. Automatic choices are never persisted and cost/quality/feedback telemetry does not reorder them. `visual-qa` accepts only vision-capable models. Provider authentication and primary `manager` / `working-manager` model selection remain OpenCode-owned. `reconfigure` changes only `primaryMode` and preserves all advanced/unknown routing fields.

Published `0.2.4` moves the most common project controls into the Node package runner:

```bash
npx --yes opencode-hi@0.2.4 reconfigure .
npx --yes opencode-hi@0.2.4 state .
npx --yes opencode-hi@0.2.4 reprofile . --profile adaptive
npx --yes opencode-hi@0.2.4 roles . --set coder=provider/model-a,provider/model-b
npx --yes opencode-hi@0.2.4 rotate . --role coder
npx --yes opencode-hi@0.2.4 check-update .
```

`reconfigure` changes only canonical project routing policy and preserves unknown fields; cancelling it performs no mutation. `state` is read-only and does not replace runtime `hi_status` / `hi_doctor`. `roles` accepts only the six Hi model-routed child roles; `manager` and `working-manager` remain OpenCode-owned primary model choices. `rotate` changes only an ordered child-model fallback prior and never touches credentials or provider keys. The retained Python helper remains only for advanced/compatibility options not yet mirrored by the bounded Node CLI.

## Git/source path — contributor and CI compatibility

Direct Git or local plugin loading remains supported for development/CI. Use an exact repository SHA/spec for reproducible acceptance and verify that the host actually loads the plugin. Unpinned Git source is not a release identity and is no longer the normal-user installation recommendation.

## Development/source loading

For repository development:

```bash
npm ci --prefix plugin
npm run build:plugin
```

OpenCode supports project-local plugin files under `.opencode/plugins/` and local/file plugin loading. A runtime acceptance check must observe the built plugin actually loading, not merely a configuration file containing its path/spec.

Exact-SHA read-only release preflight (no tag/push/release/publish side effect):

```bash
npm run release:preflight -- --sha "$(git rev-parse HEAD)"
```

The preflight fails closed unless the SHA is current and clean, canonical source/evidence plus packed-doc checks are green and idempotent, version owners agree, the candidate tag/version are absent remotely, and the dry-run npm package has the expected identity/files.
A committed compatibility/evidence projection may be older than HEAD only when it is an ancestor and **every** intervening change is confined to `data/validation/**` evidence attestation. Any source, docs, package, script, test, or runtime change invalidates that shortcut and requires regeneration.

## Reconfigure

For normal users on published `0.2.4`, reopen the bounded Node wizard:

```bash
npx --yes opencode-hi@0.2.4 reconfigure /path/to/project
```

The wizard covers the common executable policy decisions and preserves unrelated routing fields. Cancelling it makes no mutation. For automation use the explicit bounded commands (`reprofile`, `roles`) or non-interactive setup/install.

The retained Python helper is an **advanced/source-checkout compatibility surface** for lower-frequency executable fields not yet mirrored by the Node wizard, such as provider/model narrowing, fallback limits, detailed concurrency maps and profile thresholds. Legacy `models.mode`, `models.default`, `models.roles`, `routing.strategy`, and `routing.categoryModels` inputs are accepted only for compatibility diagnostics in `0.2.4`; they do not control model choice:

```bash
python3 scripts/native_plugin_setup.py reconfigure /path/to/project --execution-policy adaptive --primary-mode auto --max-fallbacks 2
```

The canonical complete option inventory is `data/hi-config-options.json`; documentation must not become a second mechanical config catalog.

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
| `models.mode` | diagnostic | `adaptive` | preference | parses the legacy model-selection mode for compatibility, reports it in config resolution diagnostics, and gives it no model-routing authority |
| `models.default` | diagnostic | `auto` | preference | parses the legacy fixed-model value for compatibility, reports it in config resolution diagnostics, and gives it no model-routing authority |
| `models.roles` | diagnostic | `{}` | preference | parses the legacy role-model map for compatibility, reports it in config resolution diagnostics, and gives it no model-routing authority |
| `routing.strategy` | diagnostic | `cost-quality` | preference | parses the legacy cost/quality strategy for compatibility, reports it in config resolution diagnostics, and gives it no model-routing authority |
| `routing.categoryModels` | diagnostic | `{}` | preference | parses legacy category model lists for compatibility, reports them in config resolution diagnostics, and gives them no model-routing authority |
| `routing.categoryVariants` | runtime | `{}` | preference | changes selected native model variant by task category |
| `routing.roleModels` | runtime | `{}` | preference | selects configured child-role candidates in explicit order after hard eligibility filters and before host-agent/automatic selection; primary manager roles are excluded |
| `routing.roleVariants` | runtime | `{}` | preference | changes selected native variant for a specific child-role/model pair; primary manager roles are excluded |
| `routing.maxFallbacks` | runtime | `3` | capacity | bounds fallback candidate count |
| `routing.allowedModels` | runtime | `[]` | constraint | strictly constrains Hi child routing membership to explicitly allowed runtime models; selection among eligible allowed models remains role/capability/routing driven |
| `routing.allowedProviders` | runtime | `[]` | constraint | narrows eligible providers and disables unconstrained host-default fallback when nonempty |
| `routing.deniedModels` | runtime | `[]` | constraint | denies exact models and composes project/raw denies monotonically |
| `parallel.enabled` | runtime | `true` | capacity | sets global scheduler capacity to one when disabled |
| `parallel.max` | runtime | `3` | capacity | caps total concurrently reserved execution units |
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

For OpenCode `1.18.21`, Hi's runtime inventory comes from OpenCode's structured provider state and is intersected with the host's `connected` provider IDs when that field is exposed. OpenCode has already applied `enabled_providers`, `disabled_providers`, provider `whitelist`/`blacklist`, alpha/deprecated filtering and runtime provider overrides before Hi selects child models. Hi does not scrape the full models.dev catalog and does not fabricate an offline model list when the host inventory is unavailable.

OpenCode `1.18.21` does **not** have a model-level `disabled: true` picker filter; model filtering for this host version is provider `whitelist` / `blacklist`. Do not copy newer-schema `model.disabled` examples into a 1.18.21 configuration.

Hi does not ship a fixed provider/model recommendation. At runtime it filters OpenCode's effective connected inventory through provider/model policy and hard role capability requirements. With no explicit ordered Hi role mapping, agent-supplied per-task model hint, or OpenCode agent model, Hi makes an **ephemeral capability/variant recommendation** from that live inventory. A persisted `routing.roleModels` choice is authoritative over a model-generated task hint. The automatic result is never written to project routing state, and cost/quality/feedback telemetry does not reorder it. `visual-qa` additionally requires explicit host-reported image-input capability; a text-only model or unverified `host-default` is rejected before selection and again before dispatch.

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
