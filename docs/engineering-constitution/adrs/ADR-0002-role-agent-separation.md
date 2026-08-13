# ADR-0002 — Role and Agent are distinct contracts

Status: ACCEPTED
Date: 2026-08-13

## Context

Current role Markdown mixes semantic role guidance with OpenCode agent fields.

## Decision

RoleContract is host-independent; OpenCode agent is a generated projection/observed executor identity.

## Alternatives considered

- Keep current distributed/manual ownership: rejected because parity burden and executor drift already produced concrete defects.
- Big-bang rewrite: rejected because proven runtime behavior must remain testable during migration.

## Consequences

Requires preserving eight-role behavior while reversing current generator ownership direction.

## Source evidence

- `01-SOURCE-ARCHITECTURE-STUDY.md`
- `02-RUNTIME-REALITY-MAP.md`
- `03-FAILURE-PATTERN-INVENTORY.md`
- `14-SOURCE-SEMANTICS-REGISTER.md`

## Implementation obligations

- Follow `13-MIGRATION-MATRIX.md`.
- Record concrete code/tests in `17-IMPLEMENTATION-PROOF.md`.
- Do not claim implementation from this ADR alone.
