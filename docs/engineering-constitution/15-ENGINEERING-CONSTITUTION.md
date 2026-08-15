# OpenCode-Hi Engineering Constitution

## Preamble

This Constitution defines the non-negotiable engineering rules of OpenCode-Hi. It governs **how current product truth is owned, changed, executed and proven**. It is not a migration plan, release ledger, test-count ledger or substitute for live source/runtime evidence.

When prose conflicts with live executable truth, reconcile the prose. Do not bend runtime truth to preserve an obsolete document.

## Article I — Truth precedence

For engineering decisions, use this order:

1. explicit user authority and constraints;
2. live repository source and runtime behavior;
3. executable contracts, schemas and canonical machine catalogs;
4. tests, validators and exact-host/external evidence;
5. generated current projections and receipts;
6. canonical current documentation;
7. continuation/program ledgers;
8. historical plans, research and prose.

A lower layer cannot manufacture a claim contradicted by a higher layer.

## Article II — One semantic owner

Every durable product meaning has one canonical owner. Derived views, generated projections, Markdown, host adapters, model output and historical artifacts may represent that meaning but cannot become parallel authorities.

Duplicate state/control planes are defects unless an explicit contract proves that the new object is a derived/read-only projection with bounded lifecycle.

## Article III — Ontology separation

The following concepts remain distinct:

`MISSION != TASK != WORKER != TEAM`

`ROLE != AGENT != MODEL != METHODOLOGY != TOPOLOGY`

`PERMISSION != AUTHORITY`

`CONTEXT != PROJECT_INTELLIGENCE != ARTIFACT != EVIDENCE != VERIFICATION`

`HUMAN_DECISION != AUTHORITY_GRANT`

`HOST_CAPABILITY != HI_CAPABILITY_SUPPORT`

An implementation may connect these concepts but must not collapse their ownership.

## Article IV — Hi semantics and host primitives

Hi owns host-portable product semantics. OpenCode owns its native primitives. OpenCode-native names remain OpenCode-native; normal technical primitives retain their standard names.

The dependency direction is:

```text
Hi contract -> Hi application owner -> host/executor port -> OpenCode adapter -> native primitive
```

Core product logic must not depend directly on unstable host internals when a normalized port can isolate that uncertainty.

## Article V — Capability truth

A capability is not supported because an interface, prompt, tool name or host API exists.

Support requires the complete chain:

```text
declaration -> owner -> producer -> consumer -> executor -> observed result -> state/evidence -> completion effect
```

Host-bound support requires exact T3 evidence. External publication/release claims require T4 evidence. Missing proof is `DEGRADED`, `UNSUPPORTED`, `PENDING`, or explicitly blocked—not an optimistic PASS.

Generated compatibility projections may summarize receipts but never replace them as evidence.

## Article VI — Mission, Task, Worker and Team

Mission is the canonical durable execution aggregate. Task is a bounded unit/obligation in that Mission. Worker is an execution attempt. Team is a bounded coordination projection over the same Task/Worker semantics and is not a second scheduler/database.

Worker/model output is boundary-untrusted until canonical reconciliation. Restart must preserve exact durable identities and must not invent continuity for missing native resources.

## Article VII — Roles, models and Methodologies

Role owns semantic responsibility and repository authority. Agent is a host projection/instance. Model is an execution resource. Methodology owns reusable HOW.

Role does not silently select a model. Methodology does not own routing, topology, Authority, continuation, completion or STOP. Installed/visible skill does not imply admitted, selected or loaded Methodology.

Methodology activation is default-zero and bounded. Full methodology/resource content is loaded lazily only when selected and permitted.

## Article VIII — Permission and Authority

Host Permission and Hi Authority are independent and both must be satisfied where required.

A lower-precedence layer may narrow a safety constraint but may not widen an explicit denial. Sensitive/external Authority is exact-action, exact-target and scope-bound. Generic approval prose, “continue”, a host once-grant or a Methodology cannot create reusable future Authority.

Push, publish, deploy, paid actions, credential/MFA/OAuth use and other external effects must remain explicitly authority-gated and auditable.

## Article IX — Context, Project Intelligence and token discipline

Provider context is a bounded projection, not the canonical session/state owner. Protected truth is preserved; compressible/disposable material may be summarized or pruned without rewriting durable product truth.

Project Intelligence is source-bound reusable context. It never proves correctness and never grants Authority. Retrieval must be bounded, deterministic enough to test, and freshness-aware.

Large outputs and durable references should become artifacts/references instead of repeated prompt broadcast. Context cost is an engineering resource and should be measured/limited where practical.

## Article X — Evidence, verification and completion

Prose is not proof. A WorkerResult, screenshot, BrowserObservation, Context summary or Project Intelligence record becomes Evidence only through the canonical evidence contract/admission path.

Evidence must be scoped and freshness-aware. Mutation invalidates affected proof. Verification derives from admissible Evidence; one unrelated PASS cannot hide a required failed/environment-issue check.

Completion and STOP are deterministic adjudication. Model “done”, host idle or child termination is not enough while obligations, required evidence/review, Authority state, Methodology exits or owned resources remain unresolved.

## Article XI — Process, workspace and browser ownership

Owned executors must use exact identity and fail closed on mismatch.

Process ownership binds native PID/cwd/command identity; WAIT/STOP/cleanup are distinct lifecycle operations. Workspace isolation binds exact repository/source/workspace identity; required isolation cannot silently fall back to primary. Browser execution is runtime-health-gated; BrowserObservation/screenshot is not automatic Evidence.

Restart adopts only exact owned native identity or quarantines the state. It does not recreate/mutate an ambiguous resource merely to make recovery look successful.

## Article XII — Persistence and storage

Every durable state class has one storage owner. Persistence is current-schema and strictly validated unless an explicit migration is designed and proven.

Atomicity, permissions, cleanup and recovery must match the state class. Secrets and unrelated user configuration must not be copied into setup/provenance journals merely for convenience.

Project-local Hi data belongs under the canonical Hi namespace; OpenCode-native directories remain host-owned.

## Article XIII — Git and user ownership

User dirty/staged/unrelated files are user-owned. Product code must not use broad reset/stash/checkout/restore, destructive cleanup or `git add -A` snapshots as ownership shortcuts.

Mutation ownership must be scoped. Rollback/cleanup must prove it is acting on Hi-owned state and must fail closed on unrelated user drift.

## Article XIV — Configuration

Every runtime configuration option must have:

- canonical identifier/path and type;
- precedence and default;
- validator;
- runtime consumer;
- executable effect;
- safety semantics;
- documentation;
- behavioral proof.

Options without runtime effect must be explicitly diagnostic/schema markers, not decorative configuration. Current-only configuration rejects stale/unknown compatibility aliases unless a deliberate migration contract exists.

## Article XV — Generation and documentation

Generated artifacts are deterministic projections. They must be reproducible and protected from hand-edit drift.

Documentation follows **one meaning -> one canonical documentation owner**. Historical artifacts may be retained for provenance but may not own current product truth. Mutable facts such as current host support, release status and test counts must be generated/receipt-derived or freshly measured, not manually duplicated.

User documentation states what the product does and how to use it. Engineering history must not masquerade as the current product manual.

## Article XVI — Testing and acceptance

Choose the smallest sufficient proof first, then expand by risk and changed boundary. Unit/static proof cannot replace real-host proof for host behavior. Local registry/mock tests cannot replace external T4 publication proof.

Tests must protect invariants, negative paths and failure/recovery semantics—not only happy-path implementation existence.

Environment/harness failure must remain distinguishable from product failure.

## Article XVII — Security and privacy

Untrusted input crosses explicit validation boundaries. Prompt/model output cannot directly grant tools, Authority or durable semantic truth.

Secrets must not be written to logs, telemetry, durable artifacts or setup journals in plaintext. Provider-bound context passes through privacy/sensitivity policy. External integrations receive the minimum necessary authority/data.

## Article XVIII — Change discipline

For every material change:

```text
live-source audit
-> identify canonical owner
-> smallest coherent mutation
-> focused proof
-> broader proof proportional to risk
-> generated/parity/hygiene checks
-> local checkpoint
```

Do not reopen closed architecture merely because an external reference has a different ontology. Adapt useful mechanisms below existing Hi owners unless live evidence proves the owner itself is wrong.

## Article XIX — ADR and supersession

Durable architectural choices with credible alternatives belong in ADRs. An ADR may be superseded only explicitly; silent contradictory prose is not a decision process.

Historical migration plans/proof ledgers are retained under `history/` and cannot act as current execution queues.

## Article XX — Release and external effects

Development HEAD, application version and an existing immutable release tag are separate identities. A version bump must be intentional and propagated from the canonical version owner; an old tag must never be rewritten to absorb later engineering work.

Release/publish actions require explicit authority, exact source/ref identity and external proof. If registry/account/auth conditions block publication, the status stays externally blocked without fabricating completion.
