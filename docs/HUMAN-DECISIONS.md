# Human Decision Semantics

Hi does not classify arbitrary user prose with a language-specific decision parser. Natural-language meaning remains with the host primary model and enters Hi through the bounded Semantic Assessment contract.

Deterministic runtime ownership is narrower:

- `AUTHORITY` is owned by exact action-contract + native permission/authority state and may place the mission in `waiting-user`.
- `AMBIGUITY` is represented by structured semantic state; contract-critical ambiguity blocks implementation until resolved by repository evidence or a real user decision.
- `PREFERENCE`, `ANNOTATION`, `VISUAL_DECISION`, and batching/sequencing of material questions remain host-primary interaction semantics unless they create an explicit structured mission constraint or authority gate. They are not separate prose classifiers in Hi Core.

A user question is justified only when the answer can materially change correctness, scope, preference, contract, security, irreversible effect, or authority. Low-risk reversible project-local choices should be resolved from repository evidence instead of approval ceremony. Follow-ups enter semantic quarantine and are applied only after structured assessment; side messages do not destructively rewrite MissionState through keyword routing.

## HumanDecision transport

`HumanDecisionContract` remains the only durable semantic owner. H1 adds a host-independent `HumanDecisionTransport` port with `open(decision)`, `await(decisionId)`, and `cancel(decisionId)`. The first implementation, `ChatHumanDecisionTransport`, is runtime-scoped and ephemeral: it binds waiters and bounded responses to the exact `decision_id`, rejects stale/mismatched responses, validates configured `choice` values, cleans up timeout/cancel waiters, and never writes a second decision store or persistence schema.

Current OpenCode chat/tool/event ingress synchronizes an OPEN canonical decision into that transport. A non-authority chat response may be observed by the transport and then continues through the existing HumanDecision/semantic-follow-up owner. Timeout or transport cancellation does **not** resolve the canonical HumanDecision. When a newer decision replaces an older decision for the same Mission, the stale ephemeral waiter is cancelled rather than left live.

Authority remains stricter: `authority_request` text is evaluated first by the canonical exact-action Authority runtime. Only after that runtime accepts the exact approval/reconciliation protocol may the transport record that a response was observed. Generic `yes`, `continue`, UI “Approve”, timeout, or transport cancellation cannot grant future or unrelated authority.

A future host/browser UI may implement the same port and project typed question controls without changing HumanDecision semantics. External mechanism provenance for exact question identity, waiter cleanup, timeout/cancel, and typed responses remains isolated in the source-reuse register; no external browser/session/branch control plane is adopted as Hi ownership.

## Structured host UI support boundary

OpenCode 1.18.21 and the current fetched upstream source expose pending-question events plus public `question.list`, `question.reply`, and `question.reject` APIs. The actual question-opening service remains internal to the host and is reached by OpenCode's model-facing `question` tool; the public plugin/HTTP SDK does not expose a direct `ask/open` operation. Hi therefore reports `structured-human-decision-transport` as `UNSUPPORTED` for this host version rather than triggering a model prompt and pretending that model-mediated tool selection is a deterministic transport. H1 chat transport remains the current supported HumanDecision interaction path. This limitation is independent from `browser-execution`, which is separately `SUPPORTED` only on its exact real-host-accepted, runtime-health-gated Hi-owned Playwright surface; browser support does not supply a structured HumanDecision opener.
