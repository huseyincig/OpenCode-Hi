---
name: hhc-api-interface-design
description: Use when creating or materially changing a public/internal API, event, schema, command, or interface whose boundary design and compatibility matter.
---

# API and Interface Design

Design boundaries from consumer contracts outward.

## Method
1. Identify consumers, ownership boundary, stability requirement, and compatibility window.
2. Define inputs, outputs, errors, side effects, idempotency/ordering rules, and versioning expectations.
3. Prefer small explicit contracts over leaking implementation details.
4. Reuse established project conventions unless they violate a required invariant.
5. Evaluate backward compatibility and migration/deprecation path before implementation.
6. Add contract tests or deterministic evidence at the narrowest useful boundary.

Separate interface design from post-hoc API review: this skill shapes the contract; `hhc-api-contract-review` independently checks an implemented/changed contract when review is warranted.
