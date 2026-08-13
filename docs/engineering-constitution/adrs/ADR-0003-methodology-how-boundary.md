# ADR-0003 — Methodology owns HOW only

Status: ACCEPTED
Date: 2026-08-13

## Context

Methodologies can be confused with routing, authority or capability.

## Decision

Runtime Policy owns WHETHER, Methodology owns HOW, HostCapability owns CAN.

## Alternatives considered

- Keep current distributed/manual ownership: rejected because parity burden and executor drift already produced concrete defects.
- Big-bang rewrite: rejected because proven runtime behavior must remain testable during migration.

## Consequences

Existing Stage-1 selected-vs-loaded and 27-methodology behavior remains baseline.

## Source evidence

- `01-SOURCE-ARCHITECTURE-STUDY.md`
- `02-RUNTIME-REALITY-MAP.md`
- `03-FAILURE-PATTERN-INVENTORY.md`
- `14-SOURCE-SEMANTICS-REGISTER.md`

## Implementation obligations

- Follow `13-MIGRATION-MATRIX.md`.
- Record concrete code/tests in `17-IMPLEMENTATION-PROOF.md`.
- Do not claim implementation from this ADR alone.
