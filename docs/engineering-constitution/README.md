# OpenCode-Hi Engineering Constitution

This directory separates **current engineering law** from **reference architecture material** and **historical program/provenance**. A file being preserved here does not make it current product truth.

## Current law and navigation

| Purpose | Canonical current owner |
|---|---|
| Engineering law / non-negotiable invariants | [`15-ENGINEERING-CONSTITUTION.md`](15-ENGINEERING-CONSTITUTION.md) |
| Domain ontology and semantic distinctions | [`04-DOMAIN-ONTOLOGY.md`](04-DOMAIN-ONTOLOGY.md) |
| Durable architecture decisions | [`16-ADR-INDEX.md`](16-ADR-INDEX.md) + [`adrs/`](adrs/) |
| Current continuation/program checkpoint | [`MASTER-CONTINUATION.md`](MASTER-CONTINUATION.md) |
| User-facing architecture | [`../ARCHITECTURE.md`](../ARCHITECTURE.md) |
| Machine documentation ownership | [`../../data/documentation-ownership.json`](../../data/documentation-ownership.json) |

Current product/runtime truth still comes from live source/contracts/runtime evidence before prose. The Constitution constrains engineering behavior; it does not override executable reality.

## Reference material

The following documents remain useful design/reference catalogs. They explain component contracts, schemas, generators, validation and acceptance patterns, but they are not independent runtime owners and must not be read as a current implementation-status ledger:

- `03-FAILURE-PATTERN-INVENTORY.md`
- `05-COMPONENT-METAMODEL.md`
- `06-CONTRACT-CATALOG.md`
- `07-TEMPLATE-CATALOG.md`
- `08-SCHEMA-CATALOG.md`
- `09-GENERATOR-ARCHITECTURE.md`
- `10-VALIDATION-ARCHITECTURE.md`
- `11-BEHAVIORAL-ACCEPTANCE.md`
- `12-HOST-PROJECTION-ARCHITECTURE.md`
- `14-SOURCE-SEMANTICS-REGISTER.md`

Where a reference catalog conflicts with live source/contracts/receipts or current canonical docs, the live/current owner wins.

## Historical program material

Migration plans, old runtime snapshots, source-study pass ledgers and implementation-proof snapshots are physically segregated under [`history/`](history/). They are provenance only:

- `history/00-PROGRAM-PLAN.md`
- `history/01-SOURCE-ARCHITECTURE-STUDY.md`
- `history/02-RUNTIME-REALITY-MAP.md`
- `history/13-MIGRATION-MATRIX.md`
- `history/17-IMPLEMENTATION-PROOF.md`

External source-study notes live under [`sources/`](sources/) and are also historical/reference provenance. They do not confer semantic ownership on external project names.

## Maintenance rule

New durable engineering law belongs in the Constitution or an ADR. Current mutable facts such as supported host version, release status, test count or implementation progress belong to their machine/receipt owners and must not be copied here as hand-maintained truth.
