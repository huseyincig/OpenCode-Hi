# OpenCode-Hi Threat Model

Primary boundaries are host permission denial, exact external-action authority, provider-facing secret/context handling, filesystem confinement, child callback freshness/idempotency, user-owned dirty work, release supply-chain integrity, process/workspace cleanup truthfulness, and untrusted execution.

Hi never expands host authority. Privileged external actions are bound to an exact action contract and explicit authority. Skill resources and archive/provenance paths are confined. Provider task context is bounded and freshness/provenance-scoped. Evidence that covers changed state becomes stale. User-owned dirty work is preserved. Unsupported or currently unavailable host capabilities remain explicitly degraded/unsupported instead of being simulated; supported process/workspace/browser surfaces are restricted to their exact owned acceptance boundaries and live prerequisites. Release claims require exact candidate binding and deterministic artifact evidence.

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
| `Q3-ADV-014` | `browser-observation-forgery` | HostCapability + methodology preflight/Evidence | Browser execution is supported only for the exact real-host-accepted Hi Playwright runtime and remains health-gated; BrowserObservation, tool names, prompts or screenshots alone cannot create Evidence/PASS, and unavailable health fails preflight closed. | T3 |
| `Q3-ADV-015` | `external-action-replay` | Authority exact action state + side-effect idempotency | Exact command/cwd hash owns authority; executing/completed hashes reject duplicate replay and unknown ACK requires reconciliation rather than blind retry. | T1/T2 local |
| `Q3-ADV-016` | `release-substitution` | Release-chain remote verification | Local exit=0 is insufficient; pushed ref, peeled annotated tag, release target and remote release metadata must resolve to the exact candidate commit. | T4 |
| `Q3-ADV-017` | `supply-chain-artifact-substitution` | Release quality/build manifest/SBOM provenance | Release asset SHA-256, build-input provenance, dependency graph, SBOM and third-party notices are exact-bound and drift blocks release. | T4 |

## Reference mechanisms

Q3 re-read the pinned local references before adapting the matrix mechanism: `opencode-agent-orchestration-kit` for a structurally checked threat model, `opencode-pty` for explicit process lifecycle/cleanup semantics, and `opencode-worktree` for realpath/path-containment and cleanup failure semantics. Their test/control-plane ontologies are not imported; Hi canonical ownership remains unchanged.


## PROMPT B §20 current-architecture security/privacy closure

The Q3 matrix above remains the stable adversarial baseline. PROMPT B §20 adds a current-source audit in `data/validation/prompt-b-security-privacy.json`; it does not replace the Q3 IDs. The §20 audit treats repository text, model prose, methodology resources, host events, environment values, browser content, subprocess output, package metadata, and external services as untrusted inputs rather than control-plane authority.

| Threat surface | Current owner / boundary | Current fail-closed rule |
|---|---|---|
| Secret-bearing external process requests | `ProcessRuntime` + shell policy + Authority | Shell/credential policy runs **before** external-action Authority state is created. Secret-sensitive commands cannot create pending approval state or spawn a process. |
| Durable Authority state | Authority exact-action hash + privacy boundary | Exact identity is hashed from the raw ephemeral command/cwd, while persisted pending/executing action descriptors are redacted. Completion uses the stored exact hash, not reconstructed redacted text. |
| Ledger/log persistence | Ledger owner + privacy boundary | Every durable string payload is bounded and secret-redacted at the ledger owner boundary; callers cannot bypass it by nesting an error/command inside payload objects. |
| Temporary rollback state | TemporaryMutation owner | Executable rollback commands containing detected secret material are rejected. Durable descriptions and rollback failure details are redacted. |
| Provider-facing Hi system projection | system transform + privacy boundary | Hi-added Mission runtime projection is redacted before provider insertion. Child task prompts are independently redacted at `ChildExecutionCoordinator`. |
| Process environment | Process executor boundary | Env values are execution-ephemeral and may reach the exact native PTY spawn only; they are absent from durable `ProcessContract`, Evidence, and ledger state. |
| Malicious repository/model prose | structured Authority/Evidence/Completion owners | Text may inform context but cannot grant Authority, manufacture Evidence/PASS, or close obligations. Generic prose such as “approve”, “DONE”, or “safe to release” has no control-plane effect. |
| Malicious methodology resource | project methodology provenance/admission | A project methodology must remain hash/provenance coherent and admitted before selection/loading. Methodology content never owns Authority or Completion; detailed skill/resource security is re-audited in PROMPT B §21. |
| External memory | `DisabledMemoryProvider` default | No external memory backend is enabled by default. Memory cannot own Mission/Evidence/Authority even if a future provider is added. |
| MCP | OpenCode host capability only | Hi recognizes native host capability but does not invent, configure, or own an MCP transport/runtime. Existing user MCP config is preserved rather than rewritten. |
| Telemetry | in-process deterministic metrics | Current telemetry computes bounded numeric/structural metrics only; there is no outbound telemetry sink. Token/cost data is not fabricated when host usage data is absent. |
| Browser | Playwright adapter + BrowserRuntime | Local http(s) only, credential-bearing URLs and arbitrary selectors rejected, state is exact execution-owner scoped, observations are not Evidence by themselves. |
| Package scripts / dependencies | package manifests + lock + release provenance | No install/preinstall/postinstall lifecycle script exists in Hi manifests. The canonical plugin lock is lockfile v3 with registry resolution+integrity for locked packages; the only native script allowlist is exact `msgpackr-extract@3.0.4`. Release gates separately bind SBOM/dependency graph. |
| Source reuse / license | Source Reuse Matrix + Third-Party Notices | Missing/unclear/AGPL-incompatible source is IDEA_ONLY or CLEAN_ROOM/BEHAVIOR_ONLY. Future reuse must record exact commit/file, adaptation class, license evidence, and attribution before implementation. |

### Closed defects found by §20

- `process-secret-before-authority-persistence`: Process external-action classification used to run before secret-sensitive shell policy, so a later-blocked command could already have placed a raw credential in pending Authority state.
- `durable-authority-secret-command`: pending/executing Authority descriptors used to persist the raw exact command. Exact hash identity is now preserved without plaintext credential persistence.
- `durable-ledger-secret-leak`: ledger bounding previously truncated strings but did not redact them. Redaction is now enforced at the durable ledger owner.
- `temporary-rollback-secret-persistence`: command rollback state could persist credentials and failure output could persist them in `detail`.
- `system-projection-secret-reexposure`: Hi-added Mission runtime system projection previously bypassed the provider redaction boundary.

The claim boundary is deliberately narrow: these controls protect **Hi-owned state and execution surfaces**. They do not claim that the OpenCode host/provider, user-installed MCP servers, arbitrary dependencies, external websites, or repository content are trustworthy. Those remain external/untrusted surfaces constrained by Hi policy and host permissions.
