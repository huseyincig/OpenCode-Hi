# ADR-0005 — Host capabilities require real executors

Status: ACCEPTED
Date: 2026-08-13

## Context

Past fake worktree/process/team surfaces demonstrated configuration/state can claim more than execution provides.

## Decision

Use SUPPORTED/DEGRADED/UNSUPPORTED HostCapability contracts with executor and acceptance evidence.

## Alternatives considered

- Keep current distributed/manual ownership: rejected because parity burden and executor drift already produced concrete defects.
- Big-bang rewrite: rejected because proven runtime behavior must remain testable during migration.

## Consequences

Missing primitives must fail/degrade visibly; no fictional operational claim.

## Source evidence

- `01-SOURCE-ARCHITECTURE-STUDY.md`
- `02-RUNTIME-REALITY-MAP.md`
- `03-FAILURE-PATTERN-INVENTORY.md`
- `14-SOURCE-SEMANTICS-REGISTER.md`

## Implementation obligations

- Follow `13-MIGRATION-MATRIX.md`.
- Record concrete code/tests in `17-IMPLEMENTATION-PROOF.md`.
- Do not claim implementation from this ADR alone.
