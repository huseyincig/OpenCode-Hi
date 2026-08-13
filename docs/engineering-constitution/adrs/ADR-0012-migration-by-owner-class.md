# ADR-0012 — Migrate one semantic owner class at a time

Status: ACCEPTED
Date: 2026-08-13

## Context

Big-bang metamodel rewrites risk breaking proven behavior and hiding duplicate owners.

## Decision

Use bounded parity windows followed by removal of the old owner, with local checkpoint commits.

## Alternatives considered

- Keep current distributed/manual ownership: rejected because parity burden and executor drift already produced concrete defects.
- Big-bang rewrite: rejected because proven runtime behavior must remain testable during migration.

## Consequences

Migration is slower per class but makes regressions and provenance tractable.

## Source evidence

- `01-SOURCE-ARCHITECTURE-STUDY.md`
- `02-RUNTIME-REALITY-MAP.md`
- `03-FAILURE-PATTERN-INVENTORY.md`
- `14-SOURCE-SEMANTICS-REGISTER.md`

## Implementation obligations

- Follow `13-MIGRATION-MATRIX.md`.
- Record concrete code/tests in `17-IMPLEMENTATION-PROOF.md`.
- Do not claim implementation from this ADR alone.
