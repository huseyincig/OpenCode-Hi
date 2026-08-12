---
name: hhc-design-discovery
description: Use when product or architecture intent is genuinely ambiguous and multiple materially different designs could satisfy the request.
---

# Design Discovery

Resolve meaningful design ambiguity before expensive implementation, without forcing ceremony on simple tasks.

## Method
1. Identify the smallest unresolved decision that materially changes behavior, architecture, cost, or UX.
2. Use repo/context evidence to eliminate choices that are already constrained.
3. Produce 2–3 credible approaches only when alternatives are real; state trade-offs and a preferred default.
4. For low-risk ambiguity, choose a sensible reversible default and continue. Ask the user only when semantics/authority are critical and evidence cannot resolve them.
5. Convert the selected direction into explicit task constraints/obligations; do not require a separate design document unless the decision is durable enough to justify one.

This skill must never become a mandatory pre-implementation approval gate.
