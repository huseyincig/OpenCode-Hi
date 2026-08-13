# 15 — OpenCode-Hi Engineering Constitution

Status: V1 CONSTITUTION CANDIDATE — IMPLEMENTATION MIGRATION PENDING

## Preamble

OpenCode-Hi is a host-independent orchestration/control product whose reference host is OpenCode. The product must remain truthful about what it knows, what it decides, what the host actually executes, and what evidence proves completion.

This constitution governs architecture changes. It does not freeze implementation layout. It defines semantic ownership and proof requirements.

## Article I — Truth and evidence

1. Source facts, inference and design decisions are distinct.
2. Unknown capability/model/project facts remain unknown rather than being filled with plausible precision.
3. A runtime claim that work/capability/isolation/review/completion occurred requires an observable executor/result path.
4. Green tests are evidence only for what those tests actually exercise; wrong harness invocation cannot be relabeled as product failure or success.
5. Historical suite results are historical evidence, not current closure proof after material runtime changes.

## Article II — Ontology separation

The following are distinct concepts and may not be collapsed for convenience:

```text
ROLE != AGENT != MODEL != METHODOLOGY != TASK != WORKER
     != TOPOLOGY != WORKFLOW/EXECUTION PLAN != HOST PRIMITIVE
```

Likewise:

```text
Preference != Safety Constraint != Authority != Capability != Evidence != Metadata
```

A projection or runtime snapshot may carry several of these values together, but it does not merge their ownership.

## Article III — Canonical ownership

1. Every semantic field has one canonical owner.
2. Other copies are explicitly DERIVED projections, RUNTIME snapshots or OBSERVATIONS.
3. Two canonical owners for the same meaning are invalid.
4. Prompts, generated TypeScript, host frontmatter and docs tables are not canonical merely because runtime reads them.
5. `MissionState` may be the runtime aggregate without becoming the definition site for every domain component class.

## Article IV — Component engineering standard

Every material extensible component class converges on:

```text
Canonical Contract
-> Human Authoring Template/Explanation
-> Runtime/Host Projection
-> Validation
-> Behavioral Acceptance
```

A TypeScript interface alone is not a component architecture.

## Article V — Host boundary

1. Hi decides semantic policy; the host executes native primitives.
2. OpenCode is primary/reference host, not product ontology.
3. Native-first means use the richest safe real primitive, not blindly prefer native behavior over Hi safety/authority semantics.
4. Host capabilities are `SUPPORTED`, `DEGRADED` or `UNSUPPORTED` and carry acceptance evidence/semantic loss.
5. A missing primitive is never replaced by a fictional tool, fake state machine or prompt promise.
6. Host observation is authoritative for actual agent/model/executor identity.

## Article VI — Roles and agents

1. Role is a host-independent semantic responsibility/authority contract.
2. Agent is a host-native executor configuration/identity.
3. Hi RoleContract projects to OpenCode agent fields; OpenCode agent fields do not redefine Role authority.
4. Canonical Hi agent-name collisions fail closed.
5. Primary role state must track observed host identity; foreign host agents are not silently relabeled as Hi roles.
6. Role permissions/delegation/obligation/evidence authority are mechanically represented where enforceable, not only persona prose.

## Article VII — Models

1. Model identity is independent of Role.
2. Model routing considers capability, task/risk suitability, availability and expected completion behavior/cost; raw token price alone is insufficient.
3. Requested, selected, projected, observed, effective and verified model identities are distinct.
4. Selected identity cannot be claimed as actual when host observation contradicts it.
5. Unknown capabilities are valid values.

## Article VIII — Methodologies

1. Methodology is reusable HOW.
2. Runtime Policy decides WHETHER; HostCapability proves CAN.
3. Methodology cannot grant Authority, invent a host primitive or own completion.
4. Default active methodology count remains zero unless explicitly changed by accepted design evidence.
5. Selected != loaded is observable; native lazy loading is preferred.
6. Built-in/project methodology IDs collide fail-closed according to admission policy.
7. Reusable project HOW may be admitted only with provenance and independent evidence according to project-learning rules.
8. Behavioral methodology acceptance includes baseline gap, positive scenario, negative trigger/counterexample and exit observability.

## Article IX — Configuration

1. A runtime config option must have a validator, runtime consumer and observable executor effect.
2. `CONFIG_WITHOUT_EXECUTABLE_EFFECT` is an architecture defect.
3. Precedence is semantic: safety constraints cannot be widened by lower-level preference/config.
4. Documentary/setup metadata is not disguised as runtime config.
5. Current-only semantics are preferred; obsolete compatibility fields are removed unless current product requirements justify them.

## Article X — Tasks, workers, topology and teams

1. Task is work intent; Worker is execution identity.
2. Topology decision must reach actual scheduler/dispatch behavior.
3. Actual concurrency is bounded by topology policy intersected with scheduler/provider/model capacity.
4. Team is a bounded projection over canonical TaskRuntime workers, not a second orchestration/task runtime.
5. Parallelism requires meaningful independence/write safety.
6. Explicit task inputs are validated against the same invariants as inferred decisions; explicit input is not a bypass.

## Article XI — Recovery

1. Retry is allowed only with a materially different hypothesis/action/model/context/methodology/tool/parameter or other justified change.
2. Recovery preserves Mission/Task/Worker identity where safe.
3. Replacement execution cannot create dual mutation ownership while an old conflicting executor remains unresolved.
4. Retry budgets/terminal conditions are bounded and explicit.
5. Required user action/credential/authority is not treated as an automatic retry loop.

## Article XII — Evidence and completion

1. WorkerResult and completion claims are untrusted boundary input.
2. Evidence is structured, scoped, authority-aware and freshness/invalidation-aware.
3. Project Intelligence, Context, summaries and telemetry are not Evidence.
4. `not_run` is not `passed`.
5. Fresh required Evidence + reconciled Obligations determines completion; worker prose cannot bypass deterministic completion.
6. Review findings carry structured disposition/blocking semantics.

## Article XIII — Context, artifacts and project intelligence

1. Context is minimum-sufficient and consumer-specific; availability is not relevance.
2. Semantic Context is bounded extraction tied to source freshness and is never proof.
3. Large/long-lived child output becomes Artifact/reference rather than parent transcript bulk.
4. Artifact identity, content hash and provenance are distinct.
5. Project Intelligence stores facts/patterns; reusable HOW promotes to Methodology; proof goes to Evidence; control decisions remain Runtime Policy.
6. Optional memory adapters are context/PI inputs only and never completion/authority truth.

## Article XIV — Human decisions and authority

1. HumanDecision semantic type is separate from host UI form.
2. Generic confirmation, yes/continue/ok or preference does not grant external-action Authority.
3. Authority is exact-action/target/scope-bound, consumable and auditable.
4. Credentials/MFA/OAuth, paid spend and irreversible/external effects stop for the required user/authority boundary rather than being retried blindly.
5. Natural-language keyword/regex classifiers may not own intent, negation, follow-up, approval or authority semantics.

## Article XV — Privacy and security

1. Secret/private transformation occurs before unsafe retention/network/provider boundaries where applicable.
2. Security pattern regex is permitted for technical secret/PII detection; this exception does not authorize semantic user-intent parsing.
3. Read-only and external-effect safety restrictions are monotonic under projection/config composition.
4. Project methodology/resource resolution cannot escape admitted paths/manifests.
5. External repository source reuse respects license and recorded reuse action.

## Article XVI — Storage and provenance

1. Every data class has one canonical write owner.
2. Stored state declares lifecycle `CANONICAL|DERIVED|CACHE|EPHEMERAL` and scope `PROJECT|GLOBAL|RUNTIME` where applicable.
3. Durable lifecycle state is schema-validated and safely written.
4. Generated projections/installed/admitted components may carry source revision + hashes + owner receipts.
5. Runtime/project product state remains under intended `.opencode/hi` surfaces; leaked nested runtime state in product source is invalid.

## Article XVII — Generation and projection

1. Canonical contracts are upstream of generated artifacts.
2. Generation is deterministic and network/model independent for admitted mechanical projections.
3. Generated artifacts are marked/receipted and checked for idempotence/parity.
4. A generator must not read another generated artifact as the semantic source of truth.
5. Host projections contain only host-valid fields.
6. Repetitive docs/catalogs are generated/parity-validated where practical; rationale/ADR prose remains human-owned.

## Article XVIII — Validation

The architecture validator enforces at minimum:

- owner uniqueness;
- reference integrity;
- config executable effect;
- decision executor reachability;
- host capability truth;
- projection parity;
- safety monotonicity;
- authority scope;
- evidence freshness;
- storage ownership;
- generated artifact cleanliness;
- current-only/legacy removal;
- behavioral-proof linkage.

Schema validity alone is not behavioral proof.

## Article XIX — Behavioral acceptance

1. Every material executable contract has representative positive and negative scenarios.
2. Evidence tiers are named: structural, in-process, controlled host-adapter, real host, external/release.
3. Real-host acceptance is required before claiming host integration complete, but follows deterministic migration coherence.
4. Harness/timeout failure is investigated through produced artifacts before attributing it to product behavior.
5. A new Role/Methodology/Config capability must be addable through the metamodel without reconstructing duplicate lists/policies across the codebase.

## Article XX — Current-only migration

1. Migration proceeds one owner class at a time.
2. Temporary parity windows are bounded.
3. Once new owner passes parity/behavioral gates, old owner is removed/reclassified.
4. No silent compatibility baggage.
5. Pre-existing user working-tree changes are never discarded to make migration convenient.

## Article XXI — Development and commits

1. Each coherent mutation-bearing cycle ends with verification and a local checkpoint commit.
2. Commit messages/body capture architecture decisions and proof useful for provenance.
3. Push, tag, publish, release and deploy remain separate explicit external actions and are not implied by local commit authorization.

## Amendment rule

A constitutional rule may be changed only by an ADR that states:

- observed problem/evidence;
- rule being superseded;
- alternatives;
- consequences;
- migration impact;
- behavioral acceptance required.

Changing implementation without updating the governing contract/ADR when semantics change is architectural drift.
