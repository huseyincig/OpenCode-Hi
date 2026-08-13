# ADR-0008 — Current-only contract/schema policy

Status: ACCEPTED
Date: 2026-08-13

## Context

Compatibility layers and stale schema owners accumulate duplicate truth.

## Decision

Keep only current contract semantics unless migration support is an explicit current product requirement.

## Alternatives considered

- Keep current distributed/manual ownership: rejected because parity burden and executor drift already produced concrete defects.
- Big-bang rewrite: rejected because proven runtime behavior must remain testable during migration.

## Consequences

Stale state fails clearly with repair/regeneration rather than silent legacy behavior.

## Source evidence

- `01-SOURCE-ARCHITECTURE-STUDY.md`
- `02-RUNTIME-REALITY-MAP.md`
- `03-FAILURE-PATTERN-INVENTORY.md`
- `14-SOURCE-SEMANTICS-REGISTER.md`

## Implementation obligations

- Follow `13-MIGRATION-MATRIX.md`.
- Record concrete code/tests in `17-IMPLEMENTATION-PROOF.md`.
- Do not claim implementation from this ADR alone.
