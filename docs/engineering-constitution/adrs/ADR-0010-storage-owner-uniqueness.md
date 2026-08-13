# ADR-0010 — One canonical writer per data class

Status: ACCEPTED
Date: 2026-08-13

## Context

Scattered storage surfaces create lifecycle/cleanup/provenance conflicts.

## Decision

Every stored data class declares one canonical writer, scope and lifecycle.

## Alternatives considered

- Keep current distributed/manual ownership: rejected because parity burden and executor drift already produced concrete defects.
- Big-bang rewrite: rejected because proven runtime behavior must remain testable during migration.

## Consequences

Readers/projections may multiply; canonical write ownership may not.

## Source evidence

- `01-SOURCE-ARCHITECTURE-STUDY.md`
- `02-RUNTIME-REALITY-MAP.md`
- `03-FAILURE-PATTERN-INVENTORY.md`
- `14-SOURCE-SEMANTICS-REGISTER.md`

## Implementation obligations

- Follow `13-MIGRATION-MATRIX.md`.
- Record concrete code/tests in `17-IMPLEMENTATION-PROOF.md`.
- Do not claim implementation from this ADR alone.
