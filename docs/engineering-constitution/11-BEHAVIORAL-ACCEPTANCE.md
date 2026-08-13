# 11 — Behavioral Acceptance Architecture

Status: V1 TARGET ARCHITECTURE — SCENARIO CLASSES DEFINED

## Purpose

Prove that contracts, generators and host projections change real behavior. A green schema/generator test does not prove that an agent, methodology, config option, model choice or capability is operational.

## Evidence tiers

```text
T0 STRUCTURAL
T1 IN-PROCESS RUNTIME
T2 HOST-ADAPTER SIMULATED/CONTROLLED
T3 REAL HOST
T4 EXTERNAL/NETWORK/RELEASE
```

A claim must state its tier. Lower tiers cannot be relabeled as higher-tier proof.

## Acceptance pattern

Every material behavior follows:

```text
precondition
-> selection/decision
-> executor call
-> observed effect
-> evidence/assertion
-> negative/counterexample
```

## BA01 — Role extension acceptance

Goal: prove adding a Role follows the metamodel rather than touching many duplicate lists.

Scenario:

1. add a fixture RoleContract with unique ID and existing refs;
2. schema/referential validation passes;
3. generator produces role human projection, runtime role catalog and OpenCode agent projection;
4. projection contains only valid host fields;
5. TaskRuntime can select/invoke the role in a fixture route;
6. host adapter receives the projected agent name;
7. observed agent identity matches;
8. role permission boundary is enforced;
9. deleting the fixture leaves no manual catalog edit behind.

Negative cases:

- duplicate ID;
- unknown PermissionProfile;
- read-only Role projected with edit allow;
- host collision with foreign prompt/permission;
- selected role but different observed agent.

This is the canonical “new Role” architecture acceptance requested by the program.

## BA02 — Methodology extension acceptance

1. author fixture MethodologyContract/T02;
2. negative baseline demonstrates the target behavior gap or repeated project evidence supports admission;
3. schema/resource/provenance checks pass;
4. compatible role native permission is generated;
5. methodology is selected only when semantic signals warrant it;
6. selected != loaded before native invocation;
7. native methodology load occurs on execution path;
8. exit requirement becomes observable Evidence/state;
9. negative trigger scenario does not activate it;
10. collision/unknown role/resource traversal fails.

## BA03 — Config executable-effect acceptance

For each runtime config option:

1. execute baseline with value A;
2. change only option to value B;
3. observe the documented executor difference;
4. assert safety constraints remain monotonic;
5. if no behavior changes, option fails architecture validation.

Representative targets during migration: topology/profile/model policy fields currently known to have partial or uncertain executor effect.

## BA04 — Model identity acceptance

```text
requested override/default
-> resolver selected model/variant
-> host child request projected model
-> assistant/host metadata observed
-> effective identity reconciled
```

Negative: host reports a different model; Hi records mismatch/degraded evidence rather than claiming selected identity as actual.

## BA05 — Host capability acceptance

For each `SUPPORTED` capability, run a host adapter test that reaches the real/native primitive appropriate to the tier.

For `DEGRADED`, prove fallback effect and record semantic loss.

For `UNSUPPORTED`, prove Hi refuses to claim or invoke a fake implementation.

Key examples:

- child session create/prompt/abort;
- session diff/status where used;
- process lifecycle if/when PTY capability exists;
- real workspace isolation binding if/when implemented.

## BA06 — Authority acceptance

Positive:

- exact action-bound Authority permits matching ExternalAction once/within declared scope.

Negative:

- “yes”, “continue”, unrelated confirm response or general user preference cannot authorize push/publish/release/deploy;
- authority for one target cannot authorize another;
- consumed/expired one-shot authority cannot be replayed.

## BA07 — Evidence/completion acceptance

1. WorkerResult says DONE but required Evidence absent -> Mission not complete;
2. stale evidence after mutation -> obligation reopens/remains blocked;
3. not-run verification -> not represented as pass;
4. fresh required evidence + closed obligations -> deterministic completion succeeds;
5. Project Intelligence alone cannot close proof obligation.

## BA08 — Recovery ownership acceptance

1. worker fails/no-progress;
2. recovery selects replacement path;
3. old host session abort/reconciliation is attempted and observed;
4. replacement does not start while conflicting old executor remains live/unknown when mutation overlap is possible;
5. task/worker semantic identity is preserved according to RecoveryContract;
6. bounded retry terminal condition stops loops.

## BA09 — Topology acceptance

- forced single -> actual serial dispatch;
- forced multi/parallel -> actual parallel dispatch only for independent/write-safe tasks;
- actual concurrency <= topology.parallelism AND scheduler/provider/model capacity;
- topology metadata alone cannot claim parallel execution when scheduler remains serial.

## BA10 — Context/artifact acceptance

- child gets minimum selected context, not global broadcast;
- large output persists as artifact and parent receives bounded reference/handoff;
- semantic context source hash invalidates stale extraction;
- protected/private content respects Privacy boundary;
- artifact ID/content hash remain distinct.

## BA11 — Human decision acceptance

- preference/ambiguity/value judgment produces typed HumanDecision;
- host UI projection can be picker/confirm/text without changing semantic type;
- cancellation/resume is explicit;
- authority_request requires Authority boundary processing rather than generic answer parsing.

## BA12 — Generator idempotence acceptance

Run generator twice on identical canonical contracts. Second run produces zero diff. Mutate one canonical field and assert only declared dependent projections change.

## Methodology behavioral pressure test

Inspired by the useful Superpowers pattern but owned by Hi:

```text
BASELINE GAP
-> APPLY METHODOLOGY
-> POSITIVE SCENARIO
-> COUNTEREXAMPLE/NEGATIVE TRIGGER
-> EXIT OBSERVABILITY
```

Admission is not justified by prose quality alone.

## Real-host acceptance boundary

Real OpenCode acceptance is required before claiming host integration complete, but it occurs after deterministic architecture migration is coherent. Tests must capture:

```text
OpenCode version/build identity
actual config/agent inventory
request metadata
child session IDs
observed agent/model identity
native methodology/tool execution evidence
result/evidence reconciliation
```

A timeout/harness failure is classified separately from product behavior; artifacts are inspected before declaring product FAIL.

## Completion criteria for this deliverable

Behavioral architecture is implemented when representative BA01–BA12 scenarios are executable, mapped to contract IDs and reported by the implementation-proof ledger with tier and result.
