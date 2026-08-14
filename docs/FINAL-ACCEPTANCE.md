# OpenCode-Hi 0.1.0 Final Acceptance

This document binds the current acceptance state for OpenCode-Hi 0.1.0. It distinguishes real-host evidence for the current worktree from exact-candidate release evidence.

## Status

**LOCAL SOURCE/TEST ACCEPTED — EXACT-CANDIDATE REAL-HOST REBIND AND REMAINING EXTERNAL GATES PENDING**

There are zero known blocking internal findings after the current repository-wide architecture, security, storage, identity, runtime, packaging, and documentation audit.

Historical/current-worktree OpenCode host receipts are source-bound evidence only. Subsequent source changes require exact-candidate host revalidation before release readiness can be claimed.

## Current regression gates

- TypeScript build and complete Node runtime/acceptance suite: **457/457 PASS** at the latest controlled run.
- Python validation suite: **47/47 PASS**.
- Source validator: **PASS**.
- Nine deterministic execution-policy benchmark scenarios: **9/9 PASS**.
- Product identity / no-legacy-product compatibility surface: **PASS**.
- Terminology and naming gate: **PASS**.
- Filesystem hygiene and ownership-aware lifecycle: **PASS**.
- Capability-driven storage ownership: **PASS**.
- 27-methodology artifact/ownership audit: **PASS**.
- Context Governor / Project Intelligence / Semantic Context: **PASS_LOCAL**.
- Privacy Boundary and synthetic-secret leak protections: **PASS_LOCAL**.
- Authority, evidence freshness, deterministic Completion/STOP: **PASS_LOCAL + PASS_HOST_CURRENT_WORKTREE**.
- Non-interactive shell safety: **PASS_LOCAL**. Native process-control is **DEGRADED** and workspace-isolation execution is **UNSUPPORTED** on the current OpenCode adapter; Hi does not fake these capabilities.
- Source reuse/license matrix and attribution review: **PASS_LOCAL**.

## Real OpenCode host acceptance

The host receipt is `data/validation/external-opencode-hi-0.1.0-host-1.18.18-head-c5d8287.json`.

The following passed on OpenCode 1.18.18 against exact runtime source `c5d8287`:

- native local plugin loading through `.opencode/plugins/`;
- Hi config hook registration of eight canonical native agents;
- explicit Hi skill path registration;
- native `skill` tool discovery and loading of `hi-code-review`;
- provider inventory filtering to the actually connected provider set;
- DIRECT low-risk review with Working Manager, zero child workers, fresh review evidence, all gates closed, and deterministic STOP;
- explicit independent review with a native `qa-reviewer` child session;
- child effective model and model-variant verification from assistant runtime metadata;
- native permission `ask`, one-shot allow, and reject behavior without fake approval;
- rejection of shell polling while event-driven worker waiting remained valid;
- materially different bounded retry after a permission/profile mismatch;
- successful recovery reviewer completion with review and verification obligations closed;
- final mission completion and deterministic STOP;
- install → doctor → uninstall filesystem lifecycle while preserving unrelated OpenCode configuration and durable Hi-owned project data.

The host observed only `opencode-go` and `opencode` as connected providers. Hi no longer treats the full provider catalog as runtime-available inventory.

## Product identity gate

OpenCode-Hi has no legacy product compatibility surface. Historical baseline identifiers are permitted only in provenance, attribution/license material, immutable historical receipts, and negative rejection tests. They are not accepted as current config, CLI, schema, telemetry, runtime, package, or skill identities.

## Storage and uninstall gate

Storage is derived from semantic ownership, scope, lifecycle, sensitivity, and retention need rather than skill name or file type.

- Project-created skills: `.opencode/skills/<skill>/`.
- Explicit Hi project policy: `.opencode/hi/policy/`.
- Setup/source ownership provenance: `.opencode/hi/provenance/`.
- Reusable evidence-backed Project Intelligence: `.opencode/hi/project-intelligence/`, lazily created.
- Retained long-form artifacts: `.opencode/hi/artifacts/`, lazily created.
- Mission-survival runtime state: OS/OpenCode state area keyed by project, not consumer repository storage.
- Redaction mappings, process state, caches and transient context: memory/OS runtime only.

Real filesystem lifecycle acceptance verified that uninstall removes setup-owned registration/provenance while preserving `$schema`, unrelated plugins, theme, MCP configuration, Project Intelligence, retained artifacts, and project-created skills.

## Remaining release blockers

The following remain release blockers:

- the current host-tested fixes must be committed by the user and bound to a new exact Git commit/ref;
- SOURCE/DISTRIBUTABLE/MANIFEST/SBOM must be rebuilt deterministically after that source freeze;
- the exact ref must pass a clean-consumer package installation receipt;
- external dependency/supply-chain installation must be verified;
- Windows runtime smoke must pass;
- if 0.1.0 is distributed through npm, the exact npm registry publish/install/integrity path must be verified.

The previous Git commit `e24f0d6455f36c4b020885c5b098e95237efc9e6` is the base of the current worktree but does not contain the real-host fixes discovered during acceptance. It must not be represented as the final exact candidate.

## Candidate binding rule

Real-host evidence is never promoted across source changes. Once the user commits the current fixes, the resulting exact Git ref becomes the candidate identity. Host binding and deterministic release artifacts must then be regenerated or revalidated against that exact ref before release readiness can be declared.
