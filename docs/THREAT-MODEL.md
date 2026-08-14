# OpenCode-Hi Threat Model

Primary boundaries are host permission denial, exact external-action authority, provider-facing secret/context handling, filesystem confinement, child callback freshness/idempotency, user-owned dirty work, release supply-chain integrity, process/workspace cleanup truthfulness, and untrusted execution.

Hi never expands host authority. Privileged external actions are bound to an exact action contract and explicit authority. Skill resources and archive/provenance paths are confined. Provider task context is bounded and freshness/provenance-scoped. Evidence that covers changed state becomes stale. User-owned dirty work is preserved. Unsupported process/workspace/browser capabilities remain explicitly degraded/unsupported instead of being simulated. Release claims require exact candidate binding and deterministic artifact evidence.

## Adversarial matrix

The machine-readable authority for this matrix is `data/validation/adversarial-threat-matrix.json`. Q3 validation requires every threat below to resolve to its canonical Hi owner, a deterministic control, executable proof test references, and T3/T4 receipts where an external-host or publication claim is applicable. The matrix is verification metadata only; it is not runtime configuration and owns no production state.

| ID | Threat | Canonical Hi owner | Deterministic control | Evidence tier |
|---|---|---|---|---|
| `Q3-ADV-001` | `prompt-injection` | Authority + structured semantic/WorkerResult contracts | Untrusted prose cannot directly grant external authority or replace structured proof; generic resume/confirmation is not approval. | T1/T2 local |
| `Q3-ADV-002` | `role-prompt-drift` | RoleContract/PermissionProfile generators + OpenCode agent binding | Canonical agent prompt/mode/permission projection is generated and canonical-name drift fails closed. | T1/T2 local |
| `Q3-ADV-003` | `host-permission-widening` | PermissionProfile + host execution-surface binding | Lower layers may narrow but cannot widen canonical Hi permissions; denied child/control-plane surfaces remain denied. | T3 |
| `Q3-ADV-004` | `path-traversal` | Skill resource resolver + provenance/archive validators | Resource/provenance/archive paths are normalized and traversal/symlink escape is rejected. | T1/T2 local |
| `Q3-ADV-005` | `external-directory-escape` | PermissionProfile/OpenCode host projection | Canonical agents default external_directory to deny; project resource access uses admitted bounded paths instead of arbitrary external-directory widening. | T1/T2 local |
| `Q3-ADV-006` | `stale-child-callback` | Mission generation + TaskRuntime/plugin callback gate | Child callbacks are accepted only for the current mission/generation/reconcile state; stale generation callbacks are ignored. | T1/T2 local |
| `Q3-ADV-007` | `duplicate-child-callback` | TaskRuntime result reconciliation + permission event idempotency | Duplicate worker result digests and repeated permission event IDs are idempotently ignored instead of reapplying state. | T1/T2 local |
| `Q3-ADV-008` | `user-dirty-file-ownership` | Native diff ownership + staging safety | Pre-existing dirty baselines remain user-owned; staging/topology mutations require fresh ownership/cleanliness proof and cleanup restores baseline, not HEAD. | T1/T2 local |
| `Q3-ADV-009` | `context-poisoning` | ContextReference/ContextArtifact/SemanticContext selection | Task context is explicit consumer-bound minimum context; unknown artifacts fail closed and durable content is consumed only while live freshness holds. | T1/T2 local |
| `Q3-ADV-010` | `pi-poisoning` | ProjectIntelligence contract/store | PI requires provenance/freshness/consumer eligibility, becomes stale on source drift, and never converts into Evidence. | T1/T2 local |
| `Q3-ADV-011` | `summary-poisoning` | WorkerResult/Evidence contracts + context compaction | Free-form summary remains bounded context only; completion proof must be structured admissible Evidence and oversized context uses bounded native summary without appending the original bulk. | T1/T2 local |
| `Q3-ADV-012` | `process-orphan` | ProcessContract + ProcessRuntime + OpenCodePtyAdapter | Hi-owned processes bind PID/cwd/native-command identity; restart re-adopts only exact owners, mismatches are quarantined without signal, and STOP terminates then separately cleans owned processes. Exact OpenCode 1.18.18 T3 acceptance binds the claim. | T3 |
| `Q3-ADV-013` | `workspace-cleanup-loss` | IsolationDecision / WorkspaceLease / WorkspaceRuntime / OpenCodeWorkspaceAdapter | W2/W3 bind source-baseline worktree identity, exact child workspace routing, isolated write/verification, primary/user-dirty preservation, cleanup, restart adoption and orphan quarantine without recreation; exact OpenCode 1.18.18 receipt promotes only the Hi-owned isolation surface. | T3 |
| `Q3-ADV-014` | `browser-observation-forgery` | HostCapability + methodology preflight/Evidence | Browser execution is UNSUPPORTED without a deterministic executor/evidence adapter; tool names, prompts or screenshots cannot promote support. | T3 |
| `Q3-ADV-015` | `external-action-replay` | Authority exact action state + side-effect idempotency | Exact command/cwd hash owns authority; executing/completed hashes reject duplicate replay and unknown ACK requires reconciliation rather than blind retry. | T1/T2 local |
| `Q3-ADV-016` | `release-substitution` | Release-chain remote verification | Local exit=0 is insufficient; pushed ref, peeled annotated tag, release target and remote release metadata must resolve to the exact candidate commit. | T4 |
| `Q3-ADV-017` | `supply-chain-artifact-substitution` | Release quality/build manifest/SBOM provenance | Release asset SHA-256, build-input provenance, dependency graph, SBOM and third-party notices are exact-bound and drift blocks release. | T4 |

## Reference mechanisms

Q3 re-read the pinned local references before adapting the matrix mechanism: `opencode-agent-orchestration-kit` for a structurally checked threat model, `opencode-pty` for explicit process lifecycle/cleanup semantics, and `opencode-worktree` for realpath/path-containment and cleanup failure semantics. Their test/control-plane ontologies are not imported; Hi canonical ownership remains unchanged.
