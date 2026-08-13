# ADR-0004 — Authority is exact-action-bound

Status: ACCEPTED
Date: 2026-08-13

## Context

Natural-language/generic confirmation can be misread as permission for external effects.

## Decision

Separate HumanDecision from Authority; bind grants to exact action/target/scope.

## Alternatives considered

- Keep current distributed/manual ownership: rejected because parity burden and executor drift already produced concrete defects.
- Big-bang rewrite: rejected because proven runtime behavior must remain testable during migration.

## Consequences

External effects remain blocked without matching authority; generic continuation is non-authoritative.

## Source evidence

- `01-SOURCE-ARCHITECTURE-STUDY.md`
- `02-RUNTIME-REALITY-MAP.md`
- `03-FAILURE-PATTERN-INVENTORY.md`
- `14-SOURCE-SEMANTICS-REGISTER.md`

## Implementation obligations

- Follow `13-MIGRATION-MATRIX.md`.
- Record concrete code/tests in `17-IMPLEMENTATION-PROOF.md`.
- Do not claim implementation from this ADR alone.
