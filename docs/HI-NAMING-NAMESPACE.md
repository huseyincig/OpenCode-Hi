# Hi Naming & Namespace Guard

Status: **N0 invariant + N1 final normalization complete on current source**

This document defines the naming boundary for all work after A5. It is intentionally a bounded guard, not a mass-rename program.

## Canonical product language

The canonical product terminology is **Hi**. `HHC` is not a parallel product, domain, namespace, runtime, or semantic owner and must not be introduced on living Hi surfaces.

Canonical semantic ownership remains:

| Concept | Canonical Hi owner |
|---|---|
| Mission | Hi Mission |
| Task | Hi TaskRuntime / TaskContract |
| Worker | Hi WorkerContract |
| Role | Hi RoleContract |
| Permission | Hi PermissionProfile + host monotonic projection |
| Methodology | Hi MethodologyContract |
| Evidence | Hi Evidence |
| Verification | Hi VerificationEnvelope |
| HumanDecision | Hi HumanDecision |
| Authority | Hi Authority |
| ExternalAction | Hi ExternalAction |
| Team | Hi Team projection |
| Project intelligence | Hi ProjectIntelligence |
| Context | Hi ContextReference / ContextArtifact / ContextGovernor |

Future canonical capabilities follow the same language. Examples include Hi `ProcessContract` / `ProcessExecutor`, Hi `IsolationDecision` / `WorkspaceLease`, and Hi `BrowserExecutor` / `BrowserObservation`.

## Four naming layers

### 1. Hi-owned semantics and application

Anything redesigned or independently implemented for Hi under the canonical architecture uses Hi-owned domain terminology. Learning a mechanism, algorithm, test strategy, or engineering idea from another project does not transfer semantic ownership or branding.

A reference implementation may influence mechanics while the resulting canonical owner remains Hi.

### 2. OpenCode native primitives

Actual OpenCode host primitives keep their real names at the host/adapter boundary. Do not rename real OpenCode session, permission, tool, event, provider, PTY, LSP, workspace, or similar primitives merely to make them look Hi-owned.

Example boundary:

```text
Hi ProcessContract
  -> Hi ProcessExecutor
  -> OpenCodePtyAdapter
  -> OpenCode PTY
```

Likewise:

```text
Hi WorkspaceLease
  -> GitWorktreeAdapter / OpenCodeWorkspaceAdapter

Hi ContextGovernor
  -> OpenCode provider/message projection
```

Hi owns the semantic contract/application behavior; OpenCode keeps ownership of its native primitive.

### 3. General technical primitives

General technical terms such as PTY, PID, process group, LSP, Git worktree, WebSocket, JSON-RPC, HTTP, and filesystem keep their normal technical names. They are not external product branding.

### 4. Explicit external integrations

A real external runtime/service may appear by its actual product name only in an explicit adapter/provider/connector integration boundary. For example, a real Supermemory API integration could correctly expose a `SupermemoryProvider`.

A research reference alone is never sufficient reason to create product-branded runtime owners such as `DCPManager`, `OcttoDecision`, `SkillfulRegistry`, `FlowDeckContext`, or `OrchestraWorkerPool`.

## External research provenance

Projects under `/workspace/arastirma/repos` are mechanism/reference sources. Their names belong in provenance, research, source-reuse/license material, or in a genuine explicit integration boundary.

Reference-to-Hi examples:

```text
DCP provider-bound pruning idea
  -> Hi ContextGovernor implementation

opencode-pty lifecycle mechanisms
  -> Hi ProcessContract / ProcessExecutor

octto typed-decision UX ideas
  -> Hi HumanDecisionTransport

opencode-skillful lazy registry approach
  -> Hi SkillCatalogIndex
```

Mechanism can be adapted; ontology and branding do not become canonical merely because a reference was studied.

## Methodology and skill naming

Methodologies and skills rewritten for Hi and admitted/selected/loaded through Hi MethodologyContract are Hi-owned semantics.

N0 does **not** bulk-rename existing canonical methodology/skill IDs, persisted schema keys, public config names, generated references, or compatibility-sensitive identifiers. Candidate future IDs such as `hi-debugging`, `hi-test-driven-development`, `hi-verification`, `hi-security-review`, and `hi-source-driven-development` illustrate the intended product language, not an N0 migration mandate.

That source-driven migration analysis belongs to **N1 — Final Hi Namespace Normalization**, after the engineering work-package program is complete.

## N0 executable guard

N0 adds a deterministic architecture naming guard. It checks living canonical Hi code/data/docs for accidental foreign-product namespace adoption while deliberately excluding provenance/research material and explicit integration boundaries.

The guard is semantic-surface oriented rather than a blind repository-wide word ban:

- canonical runtime/contracts/config/generated/roles/Hi skills/Hi data may not introduce `HHC`/`OHO` or external reference branding as owners;
- selected living product docs are checked by the same rule;
- OpenCode adapter paths are not treated as foreign-brand violations for real OpenCode primitives;
- explicit `integrations`, `providers`, or `connectors` boundaries may carry a genuine external product name;
- research, immutable receipts, historical provenance, source-reuse/license material, and engineering source-study documents are not rebranded by this checkpoint.

## N0 scope discipline

N0 does not redesign A1–A5, change canonical owners, bump persistence for naming, break public compatibility, perform mass rename, copy external implementations, or create a second manager/control plane.

## N1 final normalization

Final N1 audit result: **PASS**. The replayable receipt is `data/validation/namespace-normalization-0.1.0.json`, generated by `scripts/generate-namespace-audit.mjs`. N1 expanded the executable guard to living product/config catalogs plus architecture-reality, installation, and release documentation; corrected stale process-ownership language in the living architecture reality map; confirmed all 27 built-in skills remain `hi-*`, model-facing tools remain `hi_*`, role/config IDs carry no foreign semantic branding, and no living suspicious namespace path remains. Historical provenance, immutable receipts, source-study records, and explicit negative rejection tests remain exact rather than being cosmetically rewritten.

After all engineering work packages complete, **N1 — Final Hi Namespace Normalization** will source-audit variable/class/interface/type names, files/directories, methodology/skill IDs, config keys, generated artifacts, persisted references, user-facing names, commands, and stale historical aliases. Any migration must be justified by semantic ownership plus compatibility/persistence evidence.

The final target is one coherent Hi product language: a source reader should see one semantic architecture and one product identity, not a collage of reference-project ontologies.

## Permanent rule

**OpenCode-native remains OpenCode. General technical primitives keep their real technical names. A real external integration may carry its actual product name. Anything redesigned and owned by Hi as canonical semantic/runtime/methodology/skill belongs to Hi's product language.**
