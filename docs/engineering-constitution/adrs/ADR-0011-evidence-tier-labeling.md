# ADR-0011 — Acceptance evidence tiers are explicit

Status: ACCEPTED
Date: 2026-08-13

## Context

In-process tests can be overstated as real-host/external proof.

## Decision

Label structural, in-process, controlled adapter, real-host and external/release evidence separately.

## Alternatives considered

- Keep current distributed/manual ownership: rejected because parity burden and executor drift already produced concrete defects.
- Big-bang rewrite: rejected because proven runtime behavior must remain testable during migration.

## Consequences

Release claims cannot rely on lower-tier evidence without explicit boundary.

## Source evidence

- `01-SOURCE-ARCHITECTURE-STUDY.md`
- `02-RUNTIME-REALITY-MAP.md`
- `03-FAILURE-PATTERN-INVENTORY.md`
- `14-SOURCE-SEMANTICS-REGISTER.md`

## Implementation obligations

- Follow `13-MIGRATION-MATRIX.md`.
- Record concrete code/tests in `17-IMPLEMENTATION-PROOF.md`.
- Do not claim implementation from this ADR alone.
