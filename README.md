# OpenCode-Hi

[Türkçe README](README.tr.md)

OpenCode-Hi is an evidence-aware adaptive execution and Hybrid Intelligence control plane for AI-assisted software engineering on OpenCode. It keeps OpenCode native execution primitives authoritative while OpenCode-Hi owns evidence-aware execution-control semantics, decision routing, verification, and deterministic completion.

Its operating principle is **minimum sufficient computation with maximum relevant judgment**: use the cheapest sufficient model/tool trajectory, the smallest useful context and topology, risk-proportional verification, and human judgment only when authority, preference, ambiguity, or irreversible impact materially requires it.

## Status

The repository is on the `0.1.x` development line. `0.1.0` is the first coherent OpenCode-Hi candidate and is considered ready only when the repository's verification and candidate-binding gates pass. Historical v58 validation receipts remain provenance and are not treated as fresh 0.1.0 evidence.

## Installation

Project-local OpenCode configuration is:

`<project-root>/opencode.json`

If the file already exists, preserve unrelated settings and merge the OpenCode-Hi plugin entry. If it does not exist, create it. OpenCode-Hi does not unpack product source into the repository root; all Hi-owned project data lives under `<project-root>/.opencode/hi/`. See [Filesystem Layout](docs/FILESYSTEM-LAYOUT.md). The canonical package name is `opencode-hi`. Register it in the OpenCode project configuration as a package plugin; OpenCode installs package plugins into its own cache rather than unpacking product source into the repository. See [Installation](docs/INSTALLATION.md).

A restart of the OpenCode host is required after plugin configuration changes when the host does not hot-reload plugin configuration.

## Configuration

OpenCode-Hi supports bounded adaptive policy with explicit override precedence:

1. task/user override
2. project policy
3. raw/native Hi-compatible input
4. OpenCode-Hi adaptive selection
5. host/provider default

Execution topology may remain adaptive, be constrained to one agent, or explicitly permit multi-agent execution. Model selection may remain adaptive, fixed, or role-mapped. Capability availability never implies activation.

## Architecture

OpenCode-Hi owns mission interpretation, obligations, execution policy, topology decisions, model/tool policy, context policy, host-capability gating, evidence requirements, retry/recovery, human-decision routing, continuation, completion adjudication, and authoritative STOP. Workspace isolation is not an operational 0.1.x capability unless a task can be bound to an isolated host workspace with owned provisioning and cleanup.

OpenCode owns native host primitives: sessions, child sessions, model/provider execution, tools, permissions, shell, events, edits, and host lifecycle.

Hi methodologies own reusable HOW only. OpenCode native skills are the lazy-loading host primitive for methodology content; neither methodologies nor native skills own routing, topology, models, authority, continuation, completion, or STOP.

See [Architecture](docs/ARCHITECTURE.md), [Execution Policy](docs/EXECUTION-POLICY.md), [Context](docs/CONTEXT.md), and [Hosts](docs/HOSTS.md).

## Agents and models

Role, agent instance, model, and topology are independent concepts. The adaptive path defaults to one agent and one sufficient model when that is enough. Multi-role single-agent, multi-agent shared-model, role-mapped models, and repeated role instances are supported only when policy and host capability justify them.

## Methodologies and OpenCode skills

The canonical methodology namespace is `hi-*`. OpenCode-Hi ships **27 built-in methodologies** with default-zero activation, typical 0–1 composition, and a hard maximum of 3. On the primary OpenCode host, selected methodology content is loaded lazily through the native `skill` primitive; OpenCode-visible skills are not automatically Hi-selectable methodologies. Large methodology resources are accessed lazily and path-safely. See [Methodologies and OpenCode Skills](docs/SKILLS.md).

## Authority and human decisions

Hi may restrict host authority but never expand it. Read-only intent does not silently become mutation authority. Human interaction is reserved for decisions where authority, preference, contract ambiguity, security, or irreversible effects can materially change the outcome. See [Human Decisions](docs/HUMAN-DECISIONS.md).

## Privacy

Local knowledge is not automatically provider knowledge. Provider-facing context passes through sensitivity filtering and redaction; plaintext secrets must not be written to telemetry, durable artifacts, mission state, or logs. See [Privacy](docs/PRIVACY.md).

## Doctor, update, and uninstall

Lifecycle behavior preserves unrelated user configuration. Doctor/diagnostic flows report product, configuration, and environment problems without converting environment blockers into product failures. Update/reinstall and uninstall must preserve foreign plugins and user-owned configuration. Exact commands and verified resolver syntax are maintained in [Installation](docs/INSTALLATION.md) and [Verification](docs/VERIFICATION.md).

## Supported OpenCode version

The v58 provenance includes real OpenCode CLI `1.18.16` receipts. Those historical receipts do not by themselves certify the 0.1.0 candidate. The exact 0.1.0 supported-host statement is bound only after fresh loader/runtime verification.

## Portability

OpenCode is the reference host for `0.1.x`. Core mission, evidence, authority, completion, execution-policy, context-policy, topology, failure, and human-decision semantics are kept behind a host-capability boundary so future Codex, Claude Code, Cursor, or MCP-capable adapters are not architecturally blocked. Full alternate-host adapters are not required for `0.1.0`.

## Development and verification

From `plugin/`:

```sh
npm run build
npm test
```

From the repository root:

```sh
python -m pytest -q
python scripts/validate.py
```

Release-candidate construction uses `scripts/release-build.py` only after the build and verification gates pass. See [Verification](docs/VERIFICATION.md) and [Release](docs/RELEASE.md).

## License

OpenCode-Hi is licensed under Apache-2.0. Third-party dependencies, adapted concepts, clean-room decisions, and attribution requirements are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [Source Reuse Matrix](docs/SOURCE-REUSE-MATRIX.md).
