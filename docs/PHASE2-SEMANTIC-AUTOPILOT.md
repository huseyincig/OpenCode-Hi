# Phase 2 — Hi Semantic Autopilot & Decision Intelligence

**Status:** ACTIVE DESIGN / IMPLEMENTATION REFERENCE
**Opened:** 2026-08-18
**Phase 1 retained product:** `8f6b19098b1db0a739bb97f82537fcdc45896278`

## 1. Purpose

Phase 1 made OpenCode-Hi a substantially stronger deterministic control plane. Phase 2 makes that control plane decide **what minimum execution is worth doing** before probabilistic execution spends context, tools, models, browser state, workers, or wall time.

This is not a second scheduler rewrite and not a prompt-only agent persona layer. The Phase 2 product boundary is:

```text
User / follow-up
    ↓
Semantic assessment
    ↓
Semantic Decision Envelope
    ├─ execution path: DIRECT | EVIDENCE | PLANNED | ESCALATED
    ├─ topology intent: single | bounded fan-out
    ├─ capability intent: repo/web/process/workspace/browser/skill
    ├─ assurance: deterministic evidence | fresh reviewer
    ├─ model class: quick | standard | deep | visual | critical
    ├─ isolation: none | candidate | exact-task-required
    └─ provider-surface phase / reasons
    ↓
Phase 1 WorkGraph / Scheduler / Attempt ownership
    ↓
Native OpenCode or external capability adapter
    ↓
Hi progress / recovery / evidence / completion
```

The envelope is a **decision contract**, not another durable state owner. Phase 1 Mission/WorkGraph/Scheduler state remains canonical.

## 2. Why Phase 2 Exists

Final M8 production evidence showed a useful asymmetry:

- Phase 1 Hi: 3/3 strict control-plane settlement.
- Pre-reset Hi: correct implementation externally, but 0/3 strict settlement.
- Vanilla OpenCode: correct and materially cheaper.

On that exact production fixture, retained Hi used approximately 2.46× wall time, 7.52× input tokens, and 5.64× OpenCode-derived cost versus vanilla. Phase 2 therefore has two coupled objectives:

1. preserve the correctness/predictability gain;
2. remove orchestration that does not earn its provider-visible cost.

The rejected M8 primary-tool cutover is a permanent warning: smaller schemas are not a product win if model behavior causes more turns, context, or cost overall.

## 3. Ownership Model

### Hi owns

- semantic normalization and decision policy;
- WorkGraph/execution topology semantics;
- exact execution ownership and scheduler policy;
- task-level isolation decision semantics;
- capability requirement/semantic-gap decisions;
- empirical model-routing observations;
- bounded context/artifact selection;
- progress/no-progress and recovery/replan/stop;
- claim-linked evidence and completion;
- exact mission authority.

### OpenCode/native/external owns when sufficient

- provider/model transport and factual inventory;
- child Session/Job transport;
- native permissions;
- tool execution;
- skill discovery/loading;
- worktree/workspace creation;
- PTY/process primitive;
- generic browser automation engine;
- generic MCP execution;
- generic transcript compaction/memory.

The rule is: **native primitive + named Hi semantic supervision**, never duplicate a generic engine merely to own it.

## 4. Decision Kernel Design

A `SemanticDecisionEnvelope` must be pure, bounded, cheap, typed and mechanically explainable. It composes already-proven Phase 1 policies rather than replacing them.

Inputs are bounded mission intent, verification policy, primary/topology configuration and current mission state when a follow-up/recovery decision genuinely depends on it.

Outputs include:

- `execution_path` — direct, evidence-first, planned or escalated;
- `topology` — execution mode, bounded parallelism and agent-count intent;
- `primary` / child-role intent — from minimum-team policy;
- `model_class` — category-level requirement, never a fabricated exact model;
- `assurance` — whether fresh independent review is required;
- `isolation` — `NONE` or `CANDIDATE` at mission level; only an exact Task can become `REQUIRED` and provision native workspace isolation;
- `capabilities` — semantic needs such as repository, web/source, browser, process and workspace eligibility, not claims that the host implements them;
- `provider_surface_phase` — the smallest control-plane phase expected to be visible to a provider;
- bounded reason codes.

Complexity target is O(C + R), where C is the bounded semantic capability set and R is the bounded returned role/reason set. No repository scan, model call, network call or host mutation belongs in this function.

## 5. Entry Frugality

The current parent first turn has an unavoidable semantic-assessment gate because execution is fail-closed until natural-language intent is normalized. Pre-M9 measurement on the exact current dist runtime is **2666 characters**.

M9 will keep this gate but compact its language. Required semantics that cannot be removed:

- user language is interpreted semantically; no English keyword classifier;
- exactly one assessment per revision before execution;
- phase/revision identity;
- closed enums for message/task/scope/risk/dependency/capability/action/verification/signal fields;
- non-material consistency;
- external actions imply authority boundary;
- scope/dependency describe material work, not verifier-only files;
- sequential means multiple ordered material units;
- debugging signal requires real diagnosis and repository-analysis support;
- follow-up semantics preserve prior mission state unless changed.

M9 acceptance requires at least 30% character reduction with invariant tests. This is a guaranteed provider-visible reduction and adds no new inference turn.

## 6. Provider-Visible Surface Strategy

Child workers already receive native OpenCode per-prompt tool overrides, role-scoped permissions, selected skills only, bounded semantic context/artifacts and optional native summaries. Phase 2 should extend this principle without pretending the current host exposes a native dynamic primary-turn tool override when it does not.

Rules:

1. Child surfaces remain exact-task scoped.
2. Parent static tool removal is not retained without repeated end-to-end evidence.
3. MCP/browser capability schemas are exposed only when the execution unit needs them and the chosen backend requires schema exposure.
4. Repeated tool output is deduplicated or projected only when correctness-critical provenance remains recoverable.
5. New OpenCode dev/V2 seams are adopted through capability probes, not branch/version folklore.

## 7. Decomposition & Model Intelligence

Current ecosystem work, especially OMO's 2026-08-18 split-first/quick-first changes, provides a useful hypothesis: safe independent pieces may be cheaper on smaller models than one large reasoning task. Hi will not encode this as doctrine.

Hi will compare at least:

```text
unsplit direct/one-worker
vs
split quick workers + fan-in
vs
stronger-model unsplit
```

A split is admissible only when:

- outputs are independently useful/verifiable;
- mutable surfaces are non-conflicting or deliberately serialized;
- dependency/fan-in semantics are explicit;
- expected spawn/context/fan-in overhead does not dominate the work;
- a coherent whole-problem judgment is not being fragmented incorrectly.

Heavy-model escalation needs a named reason such as unresolved coherent reasoning, failed lower tier with material new evidence, critical assurance, or empirically supported task-class history.

## 8. Capability & Isolation Intelligence

Mission-level uncertainty is not enough to create a worktree. The decision kernel may identify `workspace-isolation-candidate`; an exact Task must still bind the scope, reason and owner before `WorkspaceRuntime` provisions the native OpenCode workspace.

Capability policy distinguishes:

- **required semantic** — the mission needs browser/process/web/workspace semantics;
- **runtime availability** — discovered separately through host capability probes;
- **semantic sufficiency** — native capability guarantees enough ownership/evidence/cancellation;
- **binding** — native, external adapter, hybrid or unavailable.

A capability that exists but cannot provide a correctness-critical guarantee is `DEGRADED`, not silently treated as sufficient.

## 9. Browser Autopilot Direction

Current Hi browser support is a bounded Playwright-backed verification executor owned by a visual-qa task. Phase 2 expands the **decision and supervision** layer, not the browser engine.

Current Microsoft Playwright guidance differentiates two useful backends:

- Playwright CLI + skill: coding-agent oriented, concise commands, lower provider context/tool-schema pressure;
- Playwright MCP: persistent state and richer iterative page introspection for longer specialized agentic loops.

Planned policy:

```text
short coding/browser verification or bounded interaction
    -> prefer lightweight CLI/skill backend when available

persistent exploratory browser loop / rich page-state reasoning
    -> MCP or persistent backend when its context cost is justified
```

Hi must own task/attempt identity, allowed origin/workspace policy, browser session lifecycle, bounded observations, artifacts/evidence and cleanup across either backend.

## 10. Security & Authority

Decision intelligence may narrow execution but may never widen native permission or Hi mission authority.

- authority-boundary work remains single/non-speculative until exact action authority is resolved;
- unknown external-action outcome remains non-retriable until reconciliation;
- browser/MCP/process backends inherit host permission constraints;
- user/private repository data is not exported merely because a web/browser capability exists;
- isolation cannot be used to bypass filesystem/permission policy.

## 11. Measurement Model

Every Phase 2 milestone tracks correctness first, economics second.

Correctness:
- deterministic acceptance;
- strict Hi settlement;
- stale/duplicate dispatch acceptance;
- evidence freshness/attribution;
- recovery and cleanup;
- authority replay safety.

Economics:
- exact input/output/reasoning/cache tokens where exposed;
- provider cost only when actually provider-reported;
- OpenCode-derived cost separately labeled;
- wall time;
- model/tool calls;
- workers and retries;
- tool-schema bytes/chars where measurable;
- runtime projection/handoff/context bytes;
- redundant actions with a mechanical definition.

Local microbenchmarks are regression/ablation evidence, never alone a product-superiority claim.

## 12. Phase 2 Research Rule

Research is targeted and current. Reopen a source when:

- OpenCode ships/changes a relevant native seam;
- a repeated failure lacks a local root cause;
- a benchmark exposes an unexplained cost/correctness delta;
- a new capability decision is being implemented;
- a strong ecosystem implementation materially changes the design space.

Do not continuously clone/search repositories merely to increase source count. Source/test/runtime truth outweighs README or community opinion; community reports are useful for defect discovery and workload selection, not architecture authority.
