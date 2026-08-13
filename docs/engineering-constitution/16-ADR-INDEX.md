# 16 — Architecture Decision Record Index

Status: V1 ADR SET ACTIVE

## Purpose

Record decisions that must survive implementation/file-layout changes. ADR status is architectural decision status, not implementation completion.

| ADR | Decision | Status |
|---|---|---|
| [ADR-0001](adrs/ADR-0001-canonical-contract-before-projection.md) | Canonical contracts precede host projections | ACCEPTED |
| [ADR-0002](adrs/ADR-0002-role-agent-separation.md) | Role and Agent are distinct contracts | ACCEPTED |
| [ADR-0003](adrs/ADR-0003-methodology-how-boundary.md) | Methodology owns HOW only | ACCEPTED |
| [ADR-0004](adrs/ADR-0004-authority-is-exact-action-bound.md) | Authority is exact-action-bound | ACCEPTED |
| [ADR-0005](adrs/ADR-0005-capabilities-require-real-executors.md) | Host capabilities require real executors | ACCEPTED |
| [ADR-0006](adrs/ADR-0006-worker-results-do-not-own-completion.md) | Worker results do not own completion | ACCEPTED |
| [ADR-0007](adrs/ADR-0007-team-is-taskruntime-projection.md) | Team is a TaskRuntime projection | ACCEPTED |
| [ADR-0008](adrs/ADR-0008-current-only-schema-policy.md) | Current-only contract/schema policy | ACCEPTED |
| [ADR-0009](adrs/ADR-0009-deterministic-generation.md) | Canonical mechanical generation is deterministic | ACCEPTED |
| [ADR-0010](adrs/ADR-0010-storage-owner-uniqueness.md) | One canonical writer per data class | ACCEPTED |
| [ADR-0011](adrs/ADR-0011-evidence-tier-labeling.md) | Acceptance evidence tiers are explicit | ACCEPTED |
| [ADR-0012](adrs/ADR-0012-migration-by-owner-class.md) | Migrate one semantic owner class at a time | ACCEPTED |

## Supersession rule

Do not edit an accepted ADR to hide a changed semantic decision. Add a new ADR that explicitly supersedes it and update this index. Typographical/source-reference corrections that do not change the decision may be edited in place.
