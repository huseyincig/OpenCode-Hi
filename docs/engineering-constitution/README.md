# OpenCode-Hi Engineering Constitution Workspace

Status: ACTIVE

This directory is the canonical working area for the Architecture Constitution / Component Metamodel program.

## Rules

- Source facts, inference, and design decisions are labeled separately.
- No component is considered operational without an executor/consumer path and behavioral proof.
- Prompts and host artifacts are projections, not canonical product truth.
- Every material component class must converge on: canonical contract -> human template -> runtime/host projection -> validator/behavioral acceptance.
- Existing proven behavior is preserved unless a documented design decision supersedes it.
- No push, tag, publish, release, or deploy is performed by this program.

## Deliverable index

| # | Deliverable | File | Status |
|---|---|---|---|
| 00 | Program plan and gate ledger | `00-PROGRAM-PLAN.md` | ACTIVE |
| 01 | Source architecture study | `01-SOURCE-ARCHITECTURE-STUDY.md` | PASS-1 COMPLETE / 1 HOLD |
| 02 | Current runtime reality map | `02-RUNTIME-REALITY-MAP.md` | PRELIMINARY SOURCE-GROUNDED |
| 03 | Engineering failure-pattern inventory | `03-FAILURE-PATTERN-INVENTORY.md` | PRELIMINARY CLASSIFIED |
| 04 | Hi domain ontology | `04-DOMAIN-ONTOLOGY.md` | PRELIMINARY CONTRACT CANDIDATE |
| 05 | Hi component metamodel | `05-COMPONENT-METAMODEL.md` | PRELIMINARY DESIGN |
| 06 | Component contract catalog | `06-CONTRACT-CATALOG.md` | V1 CONTRACT CANDIDATE |
| 07 | Human-readable component templates | `07-TEMPLATE-CATALOG.md` | V1 TEMPLATE CANDIDATE |
| 08 | Machine schema architecture | `08-SCHEMA-CATALOG.md` | V1 SCHEMA ARCHITECTURE |
| 09 | Generator/projection architecture | `09-GENERATOR-ARCHITECTURE.md` | V1 TARGET ARCHITECTURE |
| 10 | Validation and architectural linting | `10-VALIDATION-ARCHITECTURE.md` | V1 TARGET ARCHITECTURE |
| 11 | Behavioral acceptance architecture | `11-BEHAVIORAL-ACCEPTANCE.md` | V1 TARGET ARCHITECTURE |
| 12 | Host projection/capability architecture | `12-HOST-PROJECTION-ARCHITECTURE.md` | V1 TARGET ARCHITECTURE |
| 13 | Migration matrix/order | `13-MIGRATION-MATRIX.md` | V1 ORDERED MIGRATION PLAN |
| 14 | Source adoption/rejection register | `14-SOURCE-SEMANTICS-REGISTER.md` | PASS-1 COMPLETE |
| 15 | Engineering constitution | `15-ENGINEERING-CONSTITUTION.md` | V1 CONSTITUTION CANDIDATE |
| 16 | Architecture decision records index | `16-ADR-INDEX.md` | V1 ADR SET ACTIVE |
| 17 | Implementation and proof ledger | `17-IMPLEMENTATION-PROOF.md` | ACTIVE PROOF LEDGER |

A status may advance only when the document contains enough evidence to justify it. `PENDING` is preferable to invented completeness.
