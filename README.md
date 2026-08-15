# OpenCode-Hi

[Türkçe README](README.tr.md)

OpenCode-Hi is the semantic and execution-control plane for evidence-aware AI software engineering on OpenCode. Hi owns the meaning of the work—Mission, Task, Worker, Role, Methodology, Authority, Evidence, Verification, recovery and completion—while OpenCode remains the primary native execution host for sessions, models, tools, permissions, PTY, workspace and other host primitives.

The core rule is simple:

> **Hi decides product semantics; OpenCode executes the richest correct native primitive.**

Hi is designed to use the minimum sufficient topology, model, context and verification for the task instead of maximizing agents, tokens or ceremony.

## Current product truth

The source tree currently reports application version `0.1.0`. Version identity is owned by `VERSION` and parity-validated against package metadata; it is not a statement that the current development HEAD equals the already-published GitHub `v0.1.0` source.

The GitHub `v0.1.0` release is immutable and source-bound to its release commit. The npm package bootstrap is still externally blocked: `opencode-hi@0.1.0` is not currently available from the npm registry. **Do not treat the package registration examples below as proof that registry installation is available today.** Current release state is machine-derived in `data/validation/release-status-0.1.0.json` and projected in [Release Engineering](docs/RELEASE.md).

Current host capability truth is generated from exact receipts rather than hand-maintained here. See [Host Support](docs/HOSTS.md) and `data/validation/compatibility-matrix-0.1.0.json`.

## What Hi adds

Hi adds deterministic semantics around native AI execution:

- one canonical Mission/Task/Worker ownership model;
- adaptive direct, delegated and bounded multi-agent execution;
- independent Role, model, Methodology and topology decisions;
- exact Authority and monotonic host Permission boundaries;
- source-aware Context Governor, Project Intelligence and TypeScript Semantic Context;
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
   |          +--> Context / Project Intelligence
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

### Registry distribution

The canonical package name is `opencode-hi`, but npm bootstrap publication is not yet complete. Until the registry package exists, a normal fresh-user `npm` package installation path is **not** advertised as available.

Once the registry package exists, the ownership-aware setup lifecycle can register an exact package version in a project without replacing unrelated OpenCode configuration:

```bash
python3 scripts/native_plugin_setup.py plan /path/to/project --version <version>
python3 scripts/native_plugin_setup.py install /path/to/project --version <version>
python3 scripts/native_plugin_setup.py doctor /path/to/project
```

These commands are repository tooling and the lifecycle itself is deterministically tested; successful registration is still distinct from runtime package availability/loading.

### Development/source loading

For source development, build the runtime first:

```bash
npm ci --prefix plugin
npm run build
```

OpenCode supports project-local plugins under `.opencode/plugins/` and local/file plugin loading on the accepted host. Use the host-supported local-plugin mechanism for the exact OpenCode version being tested; do not pretend a Git URL is an npm registry package.

After plugin configuration changes, restart OpenCode when the host does not hot-reload them. Runtime verification must confirm the plugin, Hi agents, tools and native skills actually load.

See [Installation and Lifecycle](docs/INSTALLATION.md) for install, upgrade, reconfigure, doctor, uninstall, rollback and recovery behavior.

## Configuration

Hi configuration is current-only and fail-closed. The canonical machine inventory is `data/hi-config-options.json`; each runtime option must have a validator, precedence, consumer, executable effect, documentation and tests. Unknown or stale configuration is not silently accepted as a compatibility feature.

Major control surfaces include execution policy/topology, primary mode, model routing, concurrency limits, context policy, methodology policy and compatibility diagnostics. Safety constraints cannot be widened by a lower-precedence layer.

See [Installation and Configuration](docs/INSTALLATION.md) and [Execution Policy](docs/EXECUTION-POLICY.md).

## Roles, models, Methodologies and skills

`ROLE != AGENT != MODEL != METHODOLOGY != TASK != WORKER != TOPOLOGY`.

Hi ships 27 built-in Methodologies under the `hi-*` namespace. A Methodology is reusable **HOW**; an OpenCode skill is the primary-host primitive used to discover/load its content. Installed skill != admitted Methodology != selected Methodology != loaded Methodology.

Role selection does not itself select a model, and a Methodology cannot grant Authority or own completion. See [Methodologies and Skills](docs/SKILLS.md).

## Safety and control

**Permission and Authority are different.** OpenCode Permission governs what the host may execute; Hi Authority binds sensitive or external effects to the exact action/target/parameters/scope that were approved. Hi may narrow host permission but cannot silently widen a denial.

User dirty, staged and unrelated files remain user-owned. Hi never treats a broad reset/stash/checkout/restore or `git add -A` snapshot as a safe ownership shortcut.

**Evidence is also different from prose.** Worker/model output, Context, Project Intelligence, Methodology content and browser observations do not become Evidence merely because they look convincing. Completion requires current obligations and fresh admissible proof to reconcile deterministically.

See [Human Decisions and Authority](docs/HUMAN-DECISIONS.md), [Verification](docs/VERIFICATION.md), [Privacy](docs/PRIVACY.md), and [Threat Model](docs/THREAT-MODEL.md).

## State and recovery

Hi-owned project state lives under `.opencode/hi/` according to explicit storage ownership. OpenCode-native plugin/skill directories remain OpenCode-owned. Durable state is current-schema only; restart reconciliation adopts exact owned resources or quarantines mismatches instead of inventing continuity.

See [Filesystem Layout](docs/FILESYSTEM-LAYOUT.md) and [Storage Architecture](docs/STORAGE-ARCHITECTURE.md).

## Documentation map

### Start here

- [Product Identity](docs/PRODUCT-IDENTITY.md)
- [Installation and Lifecycle](docs/INSTALLATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Host Support](docs/HOSTS.md)

### How Hi works

- [Execution Policy](docs/EXECUTION-POLICY.md)
- [Context Architecture](docs/CONTEXT.md)
- [Project Intelligence](docs/PROJECT-INTELLIGENCE.md)
- [Methodologies and Skills](docs/SKILLS.md)
- [Verification](docs/VERIFICATION.md)

### Safety and operations

- [Human Decisions and Authority](docs/HUMAN-DECISIONS.md)
- [Privacy](docs/PRIVACY.md)
- [Threat Model](docs/THREAT-MODEL.md)
- [Filesystem Layout](docs/FILESYSTEM-LAYOUT.md)
- [Release Engineering](docs/RELEASE.md)

### Contributors and architects

- [Contributing](CONTRIBUTING.md)
- [Engineering Constitution](docs/engineering-constitution/15-ENGINEERING-CONSTITUTION.md)
- [ADR Index](docs/engineering-constitution/16-ADR-INDEX.md)
- [Documentation Ownership](data/documentation-ownership.json)
- [Source Reuse Matrix](docs/SOURCE-REUSE-MATRIX.md)

Historical implementation reports, migration ledgers, old acceptance snapshots and source-study material are retained for provenance but are not current product truth owners.

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

OpenCode-Hi is Apache-2.0 licensed. External mechanisms, clean-room/reference-only decisions and attribution boundaries are recorded in [Third-Party Notices](THIRD_PARTY_NOTICES.md) and the [Source Reuse Matrix](docs/SOURCE-REUSE-MATRIX.md).
