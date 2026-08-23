# OpenCode-Hi

<p align="center">
  <img src="docs/assets/hi-logo.webp" alt="OpenCode-Hi logo" width="256" />
</p>

[![npm version](https://img.shields.io/npm/v/opencode-hi.svg?style=flat-square&color=CB3837&logo=npm)](https://www.npmjs.com/package/opencode-hi)
[![npm weekly downloads](https://img.shields.io/npm/dw/opencode-hi.svg?style=flat-square&color=blue&logo=npm)](https://www.npmjs.com/package/opencode-hi)
[![npm unpacked size](https://img.shields.io/npm/unpacked-size/opencode-hi.svg?style=flat-square)](https://www.npmjs.com/package/opencode-hi)
[![GitHub Release](https://img.shields.io/github/v/release/huseyincig/OpenCode-Hi?style=flat-square&logo=github)](https://github.com/huseyincig/OpenCode-Hi/releases)
[![Release Readiness](https://img.shields.io/github/actions/workflow/status/huseyincig/OpenCode-Hi/release-readiness.yml?branch=main&style=flat-square&logo=github-actions&label=release%20readiness)](https://github.com/huseyincig/OpenCode-Hi/actions/workflows/release-readiness.yml)
[![GitHub License](https://img.shields.io/github/license/huseyincig/OpenCode-Hi?style=flat-square&color=green)](https://github.com/huseyincig/OpenCode-Hi/blob/main/LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/huseyincig/OpenCode-Hi?style=flat-square&logo=github)](https://github.com/huseyincig/OpenCode-Hi/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/huseyincig/OpenCode-Hi?style=flat-square&color=yellow)](https://github.com/huseyincig/OpenCode-Hi/issues)

[Türkçe README](docs/locales/tr/README.md)

## Install in 20 seconds

Run this **inside the project you want OpenCode-Hi to manage**:

```bash
npx --yes opencode-hi@latest setup .
```

That is the clean project-registration path. It creates or preserves the project-root `opencode.json` and adds the exact published Hi package, for example:

```json
{
  "plugin": [
    "opencode-hi@0.2.2"
  ]
}
```

Hi-owned lifecycle/provenance files stay under `.opencode/hi/**`. The command does **not** create a project-root `package.json`, `package-lock.json`, or persistent root `node_modules`.

> **Do not use `npm i opencode-hi` as the OpenCode project setup command.** Plain `npm i` is npm dependency installation: it creates/updates `package.json`, `package-lock.json`, and `node_modules`, and it does not write `opencode.json` or `.opencode/hi/**` for you.

Then restart OpenCode and verify the installation:

```bash
npx --yes opencode-hi@latest doctor .
```

For the published `0.2.4` CLI, an existing Hi-owned older registration is upgraded explicitly with:

```bash
npx --yes opencode-hi@latest update .
```

Published `0.2.4` uses the friendly `install` command with **ensure** semantics: no ownership means first setup, matching ownership at the target is `NOOP`, and a matching Hi-owned older registration is upgraded safely. `setup` remains the strict first-install command. All paths preserve unrelated OpenCode configuration and fail closed on ownership/config drift.

Published `0.2.4` keeps `setup`/`install` interactive only on a real terminal, but the normal-user wizard asks just one policy question: `Auto`, `Working Manager`, or `Manager`. Topology, execution depth, specialist thresholds, and parallelism are internal Hi runtime decisions. Provider authentication and the live model inventory remain OpenCode-owned. Child-model precedence is explicit task model → explicit ordered Hi role mapping → OpenCode agent model → ephemeral capability recommendation; automatic recommendations are never persisted as user preference, and cost/quality/feedback remain telemetry rather than routing authority. After OpenCode starts, type **“Hi rol modellerini ayarla”** in chat; Hi uses `hi_role_models` to list only effective connected models and persist explicit child-role choices. CI/piped automation remains deterministic with `--non-interactive`. Reopen the primary-mode question with `npx --yes opencode-hi@0.2.4 reconfigure .`.

OpenCode-Hi is the semantic and execution-control plane for evidence-aware AI software engineering on OpenCode. Hi owns the meaning of the work—Mission, Task, Worker, Role, Methodology, Authority, Evidence, Verification, recovery and completion—while OpenCode remains the primary native execution host for sessions, models, tools, permissions, PTY, workspace and other host primitives.

The core rule is simple:

> **Hi decides product semantics; OpenCode executes the richest correct native primitive.**

Hi is designed to use the minimum sufficient topology, model, context and verification for the task instead of maximizing agents, tokens or ceremony.

## Current product truth

The current immutable public release is `opencode-hi@0.2.4` / `v0.2.4`. GitHub Releases and the npm registry remain authoritative for public availability. The published `0.2.4` release is bound to its immutable Git tag/source `19bcb4e7adf9d71b851c82cf5f74210e4ca56eb0`, successful Ubuntu/Windows Release Readiness, npm Trusted Publishing provenance, registry digest equality, and fresh-registry exact OpenCode `1.18.21` acceptance.
The `dev` branch is the active post-release development line; `main` remains the stable released `0.2.4` source line.

Current host capability truth is generated from exact receipts rather than hand-maintained here. See [Host Support](docs/HOSTS.md) and `data/validation/compatibility-matrix-0.1.0.json`.

## What Hi adds

Hi adds deterministic semantics around native AI execution:

- one canonical Mission/Task/Worker ownership model;
- adaptive direct, delegated and bounded multi-agent execution;
- independent Role, model, Methodology and topology decisions;
- exact Authority and monotonic host Permission boundaries;
- revision-bound structured user Constraint/Decision atoms with explicit supersession and fail-closed mutation enforcement;
- advisory counterfactual decision-stability diagnostics that expose local semantic sensitivity without pretending to be probabilistic confidence or routing authority;
- evidence-bound falsifiable diagnosis hypotheses; root-cause prose cannot self-certify completion or create harmful learning credit;
- bounded Mission runtime projection, durable context artifacts, TypeScript Semantic Context, and evidence-backed project methodology learning with confidence/freshness-gated admission;
- bounded prior Task outcome memory that recalls only runtime-receipted failure classes for the same structured task/dependency shape and exact current source bytes; recalled history is optional advisory context, never Evidence, routing/model reputation, Authority, or completion state;
- lazy methodology/skill discovery and loading;
- structured Evidence, VerificationEnvelope and deterministic completion;
- bounded recovery, WAIT and authoritative STOP;
- exact attempt-level usage diagnostics with lifecycle-bound causal repeat/context attribution, without turning cost/telemetry into routing authority;
- advisory benchmark uncertainty diagnostics (95% sample interval, optional Fleiss judge agreement, explicit evidence-family diversity) that never override exact deterministic certification;
- benchmark-gated atomic child-handoff context projection using explicit priority/freshness/protection metadata, with whole-group selection and no ownership of OpenCode session history;
- Hi-owned process, isolated-workspace and browser executor surfaces backed by exact-host acceptance;
- restart-safe durable state for lifecycle-significant Hi semantics;
- ownership-aware install, upgrade, reconfigure, uninstall, rollback and crash recovery.

A model saying “done”, a screenshot existing, a skill being installed, or a host API merely existing is never enough to manufacture product support or completion.

## Hi and OpenCode

```text
User intent
   |
   v
Hi semantic assessment
   |
   v
Mission -> TaskRuntime -> Worker
   |          |             |
   |          +--> Role / model / Methodology
   |          +--> Authority / Permission
   |          +--> Context / methodology learning
   |          |
   |          v
   |       Hi HostPort
   |          |
   |          v
   |       OpenCode native execution
   |          |
   |          v
   +<-- observed result / Evidence / Verification
              |
              v
        recovery / WAIT / STOP
              |
              v
         deterministic completion
```

Hi semantics are host-portable; OpenCode-specific types and uncertain host behavior stay at adapter boundaries. OpenCode-native concepts keep their real names instead of being cosmetically renamed as Hi concepts.

## Capability summary

The machine-readable compatibility projection is the canonical mutable support view. At the current recorded exact-host acceptance boundary:

- **Process lifecycle:** supported on the Hi-owned `ProcessContract` / `ProcessExecutor` surface. It covers PID-bound spawn, bounded IO, event-driven WAIT, timeout, kill, separate cleanup, restart adoption and STOP reconciliation. Arbitrary native/model-facing bash is not retroactively owned by Hi.
- **Workspace isolation:** supported on the Hi-owned `IsolationDecision` / `WorkspaceLease` / `WorkspaceRuntime` surface. Required isolation provisions and binds an alternate workspace, verifies execution there, preserves the primary/user-dirty worktree and reconciles cleanup/restart fail-closed.
- **Browser execution:** supported on the Hi-owned, runtime-health-gated browser surface. When mandatory local browser verification needs Chromium and the executable is absent, the published `0.2.4` runtime performs at most one bounded bootstrap attempt through pinned `playwright-core@1.62.1` into a Hi-owned platform cache. A failed/unavailable bootstrap becomes explicit environment/capability state; it does not self-feed verification continuations. Browser observations and screenshots are never automatically Evidence or PASS.
- **HumanDecision:** the chat transport is supported. A deterministic structured OpenCode question-opening UI transport is currently unsupported because the required public host opener is not exposed on the accepted host API.
- **Semantic Context:** the explicit first-class adapter currently supports TypeScript/TSX only. JavaScript, LSP and Tree-sitter semantic adapters are not claimed.

Exact version/platform/architecture and receipt links belong to [Host Support](docs/HOSTS.md), not duplicated prose here.

## Installation status and first use

OpenCode-Hi's normal-user path is npm-registry-first. It is a one-shot package-runner bootstrap: **no repository checkout, Bun, external Python, project-root `npm install`, project `package.json`, or persistent project-root `node_modules` is required.**

### npm registry — normal user path

For release `0.2.2`, run the package directly and let the setup command add one exact Hi registration while preserving unrelated OpenCode configuration:

```bash
npx --yes opencode-hi@0.2.2 setup /path/to/project
```

Then restart OpenCode. OpenCode owns registry package materialization/cache and native plugin loading. After restart, check the static registration/ownership state and then the live runtime surface:

```bash
npx --yes opencode-hi@0.2.2 doctor /path/to/project
```

Inside the loaded OpenCode session, `hi_doctor` is the authority for live provider/model inventory and runtime capability truth. Package `doctor` does not pretend that a configured model is authenticated or successfully callable.

To move an installation that Hi already owns to a newer exact release, run that release's package runner:

```bash
npx --yes opencode-hi@0.2.2 update /path/to/project
```

`setup`/`update` mutate only the exact Hi plugin registration plus Hi-owned provenance under `.opencode/hi/**`; foreign plugins, providers, MCP configuration and unknown user fields are preserved. OpenCode itself may create `.opencode/.gitignore`, `.opencode/package.json` or `.opencode/node_modules` for its host-owned plugin runtime; those paths are not Hi-owned bootstrap state.

### Command surfaces: package lifecycle vs loaded Hi runtime

The package runner and the loaded OpenCode plugin are deliberately separate command surfaces.

| Package command | Purpose |
|---|---|
| `install` | published `0.2.4`: ensure the target exact Hi registration (first setup, safe owned update, or NOOP) |
| `setup` | strict first Hi-owned exact plugin registration; published `0.2.4` opens the bounded project wizard when attached to a terminal |
| `update` | explicitly move an already Hi-owned registration to the requested exact release; `upgrade` is an accepted alias |
| `doctor` | static registration/ownership/drift/transaction check |
| `reconfigure` | published `0.2.4`: reopen the bounded project configuration wizard |
| `state` | read-only package/project registration + routing summary; live Mission state remains runtime-owned |
| `config` | current development: show/change Work Mode, execution limits and explicit child-role preferences in one project settings surface |
| `reprofile` | change only `executionPolicy` in project-owned routing state |
| `roles` | print/set explicit child-role model/fallback/variant mappings |
| `rotate` | rotate one child role's configured fallback order; never credentials/provider keys |
| `check-update` | read npm registry version metadata and report an advisory; never mutates the project |
| `plan` | preview the exact registration mutation without applying it |
| `rollback` | restore the one recorded lifecycle rollback point when hashes still match |
| `recover` | reconcile a recorded interrupted setup/update transaction |

### Current development settings control plane

The post-`0.2.4` `dev` line adds one user-facing settings model without replacing OpenCode model ownership or Hi routing internals:

- **Work Mode:** `Adaptive`, `Single`, or `Multi`. `Single` is a one-agent topology and therefore uses effective `working-manager` for new missions; a saved `manager` preference is preserved for non-Single modes. It still does not mean one fixed model.
- **Models:** Automatic by default, an optional strict global child-model allowlist (`routing.allowedModels`), or explicit per-role primary/fallback choices from OpenCode's effective connected inventory. The allowlist narrows child eligibility without replacing OpenCode runtime inventory truth; list order does not become Adaptive routing priority. Automatic routing also records bounded capability-ranked **recovery-only** candidates (never normal fallbacks or preferences): only after two same-model corrective attempts make no semantic gain may recovery open a fresh alternate-model child, still inside the allowlist/capability boundary.
- **Settings surfaces:** runtime `hi_settings` for live inventory-aware changes and `npx opencode-hi config` for deterministic project preferences. Multi-field runtime changes use one transaction and either all persist or none persist.
- **Natural-language changes:** settings-only chat requests go directly to `hi_settings` rather than mission execution. OpenCode-style nested tool arguments are accepted for mutations, and user-facing `review` is normalized to canonical `qa-reviewer`.
- **First use:** when no explicit project settings exist and effective models are available, one bounded onboarding hint is projected for the first pending chat session. Greetings/settings requests can open setup; material work is not interrupted and uses `Adaptive + Automatic`.
- **Live refresh:** opening runtime settings refreshes OpenCode model inventory first, so a newly connected provider can appear without restarting Hi even though exact OpenCode 1.18.21 does not expose a dedicated provider/config-updated plugin event.
- **Hot reload:** successful runtime settings changes affect new worker dispatches without restarting OpenCode.
- **Ownership:** provider authentication and primary `manager` / `working-manager` model selection remain OpenCode-owned. `hi_role_models` remains supported for compatibility.

The immutable published `0.2.4` runtime evidence below remains **34 tools**. Current `dev` adds `hi_settings`; that development-source count must not be back-written into the `0.2.4` release evidence.

After OpenCode loads the plugin, the runtime exposes **34 `hi_*` tools**. The main user-facing diagnostics are `hi_doctor`, `hi_status`, `hi_readiness`, `hi_metrics`, and `hi_ledger`. The remaining tools are bounded control-plane primitives for task/worker dispatch, process execution, browser execution, context artifacts, temporary mutations, semantic assessment, and direct progress. The exact loaded tool IDs are host-verifiable through OpenCode's documented `/experimental/tool/ids` endpoint.

For current published `0.2.4`, installation ownership is inspected with package `doctor`; live Mission state is inspected with runtime `hi_status`, `hi_readiness`, and `hi_ledger`. Published `0.2.4` additionally exposes Node-only `state`, `reprofile`, `roles`, `rotate`, and `check-update` package commands so common project configuration no longer requires the legacy Python helper.

Examples for the `0.2.4` candidate:

```bash
npx --yes opencode-hi@0.2.4 reconfigure .
npx --yes opencode-hi@0.2.4 state .
# Current dev package/source:
npx opencode-hi config . --mode adaptive
npx opencode-hi config . --mode multi --max-agents 3 --parallelism 2
npx --yes opencode-hi@0.2.4 reprofile . --profile balanced
npx --yes opencode-hi@0.2.4 roles . --set coder=provider/model-a,provider/model-b
npx --yes opencode-hi@0.2.4 rotate . --role coder
npx --yes opencode-hi@0.2.4 check-update .
```

`rotate` only changes the ordered model fallback prior for the named Hi child role. It is not credential, API-key, provider-account, or primary-model rotation. `manager` and `working-manager` model ownership remains OpenCode-native.

Published `0.2.4` keeps setup deterministic outside a real terminal and adds a bounded terminal wizard without taking over provider authentication or fabricating model availability:

```text
setup/install (TTY) -> project wizard -> restart OpenCode -> package doctor -> runtime hi_doctor
setup/install (CI/non-TTY) -> deterministic registration -> restart -> doctor -> hi_doctor
```

The normal-user wizard asks only for primary behavior (`auto` / `working-manager` / `manager`). Hi owns task topology, specialist selection, verification depth, and parallelism internally. After restart, type **“Hi rol modellerini ayarla”** in the OpenCode chat. The runtime `hi_role_models` tool lists only effective connected models and can save explicit ordered child-role model/fallback mappings; `visual-qa` only accepts vision-capable models. Without an explicit Hi mapping, Hi uses the OpenCode agent model when one exists, otherwise an ephemeral capability/variant recommendation over the live inventory. Automatic choices are not written back as preferences and are not reranked by cost/quality/feedback telemetry. `manager` / `working-manager` primary model selection and provider authentication remain OpenCode-owned. Use `reconfigure` to reopen only the primary-mode question; use `--non-interactive` for automation. The package `roles` command remains a deterministic CLI fallback.

Published availability is external state, not inferred from source version metadata alone. For `0.2.4`, GitHub Release, npm Trusted Publishing/provenance, registry digest equality, and fresh-registry exact OpenCode `1.18.21` verification are complete.

### Git source — contributor/development compatibility path

Direct Git loading remains useful for source/CI compatibility work, but it is no longer the normal-user onboarding path. Contributors may register an exact repository SHA/spec and must prove the host actually loaded the plugin; unpinned Git is not a release identity.

### Development/source loading

For repository development, build the runtime first:

```bash
npm ci --prefix plugin
npm run build:plugin
```

OpenCode supports project-local plugins under `.opencode/plugins/` and local/file plugin loading on the accepted host. Runtime verification must confirm the plugin, Hi agents, tools and native skills actually load.

After plugin configuration changes, restart OpenCode when the host does not hot-reload them.

Before any future tag/push/release/publish step, contributors can run the exact-SHA read-only preflight:

```bash
npm run release:preflight -- --sha "$(git rev-parse HEAD)"
```

A committed evidence projection may be consumed from an ancestor checkpoint only when every intervening commit is evidence-only under `data/validation/**`. Any source, documentation, package, script, test, or runtime drift requires regeneration before the preflight can pass.

It requires a clean committed SHA, runs the canonical source/evidence verification and packed-public-doc checks used by publication, verifies package/version identity plus local/remote tag and npm-version absence, then captures `npm pack --dry-run` identity. It fails if those checks generate uncommitted drift. It never creates a tag, pushes, creates a GitHub Release, or publishes to npm.

See [Installation and Lifecycle](docs/INSTALLATION.md) for Git/npm installation, upgrade, reconfigure, doctor, uninstall, rollback and recovery behavior.

**Installed the plugin? Continue with the complete [Configuration Guide](docs/CONFIGURATION.md)** for Windows, Linux, macOS, every supported option, primary/worker roles, single-model and per-role routing, multiple fallback models, variants, provider/model policy, concurrency, CLI/manual configuration, and troubleshooting.

**Türkçe:** [Kurulum ve Yapılandırma Rehberi](docs/locales/tr/CONFIGURATION.md).

## Configuration

Hi configuration is current-only and fail-closed. The canonical machine inventory is `data/hi-config-options.json`; each runtime option must have a validator, precedence, consumer, executable effect, documentation and tests. Unknown or stale configuration is not silently accepted as a compatibility feature.

Major control surfaces include execution policy/topology, primary mode, model routing, concurrency limits, context policy, methodology policy and compatibility diagnostics. Safety constraints cannot be widened by a lower-precedence layer.

See [Installation and Configuration](docs/INSTALLATION.md) and [Architecture](docs/ARCHITECTURE.md#execution-policy).

## Roles, models, Methodologies and skills

`ROLE != AGENT != MODEL != METHODOLOGY != TASK != WORKER != TOPOLOGY`.

Hi ships 27 built-in Methodologies under the `hi-*` namespace. A Methodology is reusable **HOW**; an OpenCode skill is the primary-host primitive used to discover/load its content. Installed skill != admitted Methodology != selected Methodology != loaded Methodology.

Role selection does not itself select a model, and a Methodology cannot grant Authority or own completion. See [Methodologies and Skills](docs/SKILLS.md).

## Safety and control

**Permission and Authority are different.** OpenCode Permission governs what the host may execute; Hi Authority binds sensitive or external effects to the exact action/target/parameters/scope that were approved. Hi may narrow host permission but cannot silently widen a denial.

User dirty, staged and unrelated files remain user-owned. Hi never treats a broad reset/stash/checkout/restore or `git add -A` snapshot as a safe ownership shortcut.

**Evidence is also different from prose.** Worker/model output, Context, project methodology-learning state, Methodology content and browser observations do not become Evidence merely because they look convincing. Completion requires current obligations and fresh admissible proof to reconcile deterministically.

See [Human Decisions and Authority](docs/HUMAN-DECISIONS.md), [Verification](docs/VERIFICATION.md), [Security model](docs/SECURITY-MODEL.md).

## State and recovery

Hi-owned project state lives under `.opencode/hi/` according to explicit storage ownership. OpenCode-native plugin/skill directories remain OpenCode-owned. Durable state is current-schema only; restart reconciliation adopts exact owned resources or quarantines mismatches instead of inventing continuity.

See [Architecture](docs/ARCHITECTURE.md#storage-and-filesystem-ownership).

## Documentation

- [Documentation index](docs/README.md)
- [Installation and configuration](docs/INSTALLATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Host support](docs/HOSTS.md)
- [Methodologies and skills](docs/SKILLS.md)
- [Human decisions and authority](docs/HUMAN-DECISIONS.md)
- [Verification](docs/VERIFICATION.md)
- [Security model](docs/SECURITY-MODEL.md)
- [Release engineering](docs/RELEASE.md)
- [Contributing](.github/CONTRIBUTING.md) · [Security](.github/SECURITY.md) · [Support](.github/SUPPORT.md)

## Verification

Canonical repository checks are run from the repository root:

```bash
npm run check
python -m pytest -q tests/test_hi.py
python scripts/validate.py
```

Fresh test counts belong to command output, not hand-maintained documentation. Host-bound capability claims require exact T3 receipts; real external publication claims require T4 evidence.

See [Verification Strategy](docs/VERIFICATION.md).

## License

OpenCode-Hi is Apache-2.0 licensed. External mechanisms, clean-room/reference-only decisions and attribution boundaries are recorded in [Third-Party Notices](THIRD_PARTY_NOTICES.md).
