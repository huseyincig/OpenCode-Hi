---
name: hhc-architecture-decisions
description: Use when a durable architecture, data-model, boundary, migration, or platform decision has meaningful alternatives and future maintainers need the rationale preserved.
---

# Architecture Decision Records

Capture durable decisions as a compact decision record, not a transcript of the design process.

## Record
- Context: the constraint/problem that forces a choice.
- Decision: the selected architecture or contract.
- Alternatives: only credible options considered.
- Consequences: important benefits, costs, migration/operational effects, and reversibility.
- Evidence: links to code, tests, specs, benchmarks, or authoritative sources when material.

Use the project’s existing ADR convention if one exists. Otherwise keep the artifact minimal and avoid creating bureaucracy for local/temporary choices. An ADR documents an already-owned HHC decision; it does not become a second planning or approval control-plane.
