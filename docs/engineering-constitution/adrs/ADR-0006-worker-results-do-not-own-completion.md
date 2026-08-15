# ADR-0006 — Worker results do not own completion

Status: ACCEPTED
Date: 2026-08-13

## Context

A child can claim DONE without fresh required proof.

## Decision

WorkerResult is untrusted input; Mission obligations + Evidence reconciliation owns completion.

## Alternatives considered

- Keep current distributed/manual ownership: rejected because parity burden and executor drift already produced concrete defects.
- Big-bang rewrite: rejected because proven runtime behavior must remain testable during migration.

## Consequences

Requires explicit not-run/freshness/limitations and preserves deterministic completion.

## Source evidence

- `history/01-SOURCE-ARCHITECTURE-STUDY.md`
- `history/02-RUNTIME-REALITY-MAP.md`
- `03-FAILURE-PATTERN-INVENTORY.md`
- `14-SOURCE-SEMANTICS-REGISTER.md`

## Implementation obligations

- Historical migration sequencing is preserved in `history/13-MIGRATION-MATRIX.md`; it is not a current execution queue.
- Historical implementation proof is preserved in `history/17-IMPLEMENTATION-PROOF.md`; current proof belongs to executable tests/receipts and `MASTER-CONTINUATION.md`.
- Do not claim implementation from this ADR alone.
