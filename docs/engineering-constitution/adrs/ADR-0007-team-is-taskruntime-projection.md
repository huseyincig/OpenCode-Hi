# ADR-0007 — Team is a TaskRuntime projection

Status: ACCEPTED
Date: 2026-08-13

## Context

A separate mailbox/board/team task runtime would duplicate orchestration ownership.

## Decision

TeamRuntime groups canonical tasks/workers only; no second task/message substrate.

## Alternatives considered

- Keep current distributed/manual ownership: rejected because parity burden and executor drift already produced concrete defects.
- Big-bang rewrite: rejected because proven runtime behavior must remain testable during migration.

## Consequences

Future richer host team primitive requires separate ADR/capability evidence.

## Source evidence

- `01-SOURCE-ARCHITECTURE-STUDY.md`
- `02-RUNTIME-REALITY-MAP.md`
- `03-FAILURE-PATTERN-INVENTORY.md`
- `14-SOURCE-SEMANTICS-REGISTER.md`

## Implementation obligations

- Follow `13-MIGRATION-MATRIX.md`.
- Record concrete code/tests in `17-IMPLEMENTATION-PROOF.md`.
- Do not claim implementation from this ADR alone.
