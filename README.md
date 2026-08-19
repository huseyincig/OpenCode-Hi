# OpenCode-Hi

[Türkçe README](docs/locales/tr/README.md)

OpenCode-Hi is the semantic and execution-control plane for evidence-aware AI software engineering on OpenCode. Hi owns the meaning of the work—Mission, Task, Worker, Role, Methodology, Authority, Evidence, Verification, recovery and completion—while OpenCode remains the primary native execution host for sessions, models, tools, permissions, PTY, workspace and other host primitives.

The core rule is simple:

> **Hi decides product semantics; OpenCode executes the richest correct native primitive.**

Hi is designed to use the minimum sufficient topology, model, context and verification for the task instead of maximizing agents, tokens or ceremony.

## Current product truth

This checkout tracks application/package version `0.2.1`. Version identity is owned by `VERSION` and parity-validated against package metadata. Published availability is external state: GitHub Releases and the npm registry are authoritative for whether a given version has been released. Historical `v0.1.1` and `v0.1.0` release artifacts remain immutable.

Current host capability truth is generated from exact receipts rather than hand-maintained here. See [Host Support](docs/HOSTS.md) and `data/validation/compatibility-matrix-0.1.0.json`.

## What Hi adds

Hi adds deterministic semantics around native AI execution:

- one canonical Mission/Task/Worker ownership model;
- adaptive direct, delegated and bounded multi-agent execution;
- independent Role, model, Methodology and topology decisions;
- exact Authority and monotonic host Permission boundaries;
- bounded Mission runtime projection, durable context artifacts, TypeScript Semantic Context, and evidence-backed project methodology learning;
- lazy methodology/skill discovery and loading;
- structured Evidence, VerificationEnvelope and deterministic completion;
- bounded recovery, WAIT and authoritative STOP;
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
- **Browser execution:** supported on the Hi-owned, runtime-health-gated browser surface. Browser observations and screenshots are not automatically Evidence or PASS.
- **HumanDecision:** the chat transport is supported. A deterministic structured OpenCode question-opening UI transport is currently unsupported because the required public host opener is not exposed on the accepted host API.
- **Semantic Context:** the explicit first-class adapter currently supports TypeScript/TSX only. JavaScript, LSP and Tree-sitter semantic adapters are not claimed.

Exact version/platform/architecture and receipt links belong to [Host Support](docs/HOSTS.md), not duplicated prose here.

## Installation status and first use

OpenCode-Hi can be consumed directly from Git source or from the npm registry. **The canonical source install needs only the OpenCode plugin entry below; users do not run Bun/npm, create wrapper files, or manage `node_modules` manually.**

### Git source — recommended

Add this package spec to the existing `plugin` array in `opencode.json` / `opencode.jsonc` without deleting unrelated settings:

```json
{
  "plugin": [
    "opencode-hi@git+https://github.com/huseyincig/OpenCode-Hi.git"
  ]
}
```

Restart OpenCode. OpenCode's native package loader fetches/materializes the Git package and loads `plugin/dist/plugin.js`. The current source package intentionally avoids npm/Pacote Git-preparation lifecycle triggers and keeps the OpenCode host peer optional, so native Git installation does not open a nested package build/install just to prepare Hi.

The immutable public `v0.2.0` tag predates this direct-Git packaging fix and remains historical. Release `v0.2.1` carries the correction; the unpinned Git source spec above follows current repository source.

### npm registry

The exact registry identity for this release is `opencode-hi@0.2.1`. Published releases use npm Trusted Publishing OIDC provenance and are acceptance-checked on the recorded exact OpenCode host.

A fresh project can install the exact package version and use the package-provided setup CLI without a repository checkout:

```bash
npm install --save-dev opencode-hi@0.2.1
./node_modules/.bin/opencode-hi-setup plan /path/to/project --version 0.2.1
./node_modules/.bin/opencode-hi-setup install /path/to/project --version 0.2.1
./node_modules/.bin/opencode-hi-setup doctor /path/to/project
```

Registration/doctor remain distinct from runtime loading; published-release T4 evidence verifies fresh-registry installation plus exact-host loading; current evidence details live in Release Engineering rather than being duplicated here.

### Development/source loading

For repository development, build the runtime first:

```bash
npm ci --prefix plugin
npm run build:plugin
```

OpenCode supports project-local plugins under `.opencode/plugins/` and local/file plugin loading on the accepted host. Runtime verification must confirm the plugin, Hi agents, tools and native skills actually load.

After plugin configuration changes, restart OpenCode when the host does not hot-reload them.

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
