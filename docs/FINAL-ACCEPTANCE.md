# OpenCode-Hi 0.1.0 Final Local Acceptance

This document binds the final **local** acceptance state. It does not claim external OpenCode host verification that could not be executed in the current environment.

## Status

**LOCAL_CANDIDATE_COMPLETE — RELEASE BLOCKED ON EXTERNAL RECEIPTS**

There are zero known blocking internal findings after the final repository-wide architecture, security, storage, identity, release, and documentation audit. Release readiness is not declared because the current environment has no `opencode` executable and no user-created exact Git ref for this candidate.

## Local gates

- TypeScript build and complete Node runtime/acceptance suite: PASS.
- Python validation suite: PASS.
- Source validator: PASS.
- Nine deterministic execution-policy benchmark scenarios: PASS.
- Product identity / no-legacy-product surface: PASS.
- Terminology & naming gate: PASS.
- Filesystem hygiene and ownership-aware lifecycle: PASS.
- Capability-driven storage ownership: PASS.
- 29/29 skill artifact/ownership audit: PASS.
- Context Governor / Project Intelligence / Semantic Context: PASS_LOCAL.
- Privacy Boundary and synthetic-secret leak protections: PASS_LOCAL.
- Authority, evidence freshness, deterministic Completion/STOP: PASS_LOCAL.
- Process Governor / worktree isolation / non-interactive shell safety: PASS_LOCAL.
- Source reuse/license matrix and attribution review: PASS_LOCAL.
- Deterministic source/distributable/manifest/SBOM generation: PASS_LOCAL when rebuilt from this exact source state.

## Product identity gate

OpenCode-Hi has no legacy product compatibility surface. Historical baseline identifiers are permitted only in provenance, attribution/license material, immutable historical receipts, and negative rejection tests. They are not accepted as current config, CLI, schema, telemetry, runtime, package, or skill identities.

## Storage gate

Storage is derived from semantic ownership, scope, lifecycle, sensitivity, and retention need rather than skill name or file type.

- Project-created skills: `.opencode/skills/<skill>/`.
- Explicit Hi project policy: `.opencode/hi/policy/`.
- Setup/source ownership provenance: `.opencode/hi/provenance/`.
- Reusable evidence-backed Project Intelligence: `.opencode/hi/project-intelligence/`, lazily created.
- Retained long-form artifacts: `.opencode/hi/artifacts/`, lazily created.
- Mission-survival runtime state: OS/OpenCode state area keyed by project, not consumer repository storage.
- Redaction mappings, process state, caches and transient context: memory/OS runtime only.

Uninstall removes only setup-owned registration/config/provenance surfaces; durable project knowledge, retained artifacts, project-created skills, and unrelated OpenCode/project content are preserved.

## External gates still required

The following remain `PENDING_EXTERNAL` and are release blockers rather than internal defects:

- exact-candidate OpenCode native plugin-loader smoke;
- native child-session behavior;
- model/provider binding and override behavior;
- host permission-denial runtime behavior;
- packaged agent/skill discovery through the real OpenCode resolver;
- exact Git-ref clean-consumer installation;
- external dependency/supply-chain install receipt;
- Windows runtime smoke.

No historical v58 receipt, local mock, adapter contract, or deterministic simulation may satisfy these gates.

## Candidate binding rule

Any source change after local candidate artifact generation invalidates the previous candidate hashes. Source/distributable/manifest/SBOM hashes must therefore be generated only after this final acceptance document and its machine-readable receipt are present, and must be regenerated if the source changes again.
