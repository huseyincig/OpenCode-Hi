# 17 — Implementation and Proof Ledger

Status: ACTIVE LEDGER — CONSTITUTION DESIGN DOCUMENTED, METAMODEL IMPLEMENTATION PENDING

## Purpose

Prevent design documentation from being mistaken for runtime implementation. Every migration phase records concrete files, tests, evidence tier and local commit.

## Baseline before constitution program

| Item | Evidence | Tier | Status |
|---|---|---|---|
| Team/Recovery hardening | controlled plugin suite 458/458 | T1/T2 local controlled | PASS |
| Standalone project validator | `python3 scripts/validate.py` | T0/T1 local | PASS |
| backup hygiene | 0 `.bak.*` at baseline closure | T0 | PASS |
| baseline commit | `396e1ba fix: harden team and recovery boundaries` | provenance | COMMITTED |

This proves the starting runtime state only.

## Constitution foundation

| Deliverable | Current proof | Implementation meaning |
|---|---|---|
| Source Study | 22 records; one explicit `agentic` source-version HOLD | architecture grounded; not runtime mutation |
| Runtime Reality Map | production owner/consumer/executor surfaces mapped | preliminary until contract lint is executable |
| Failure Inventory | recurring defects classified | design input |
| Domain Ontology | semantic distinctions documented | contract candidate |
| Component Metamodel | component families/dependency direction documented | design candidate |
| Contract Catalog | C01–C29 candidate contracts | schemas/runtime not yet implemented |
| Template Catalog | T01–T08 authoring shapes | parsers/generators not yet implemented |
| Schema Catalog | S00–S27 target modules/rules | implementation pending |
| Generator Architecture | current generator gap + target G01–G06 | implementation pending |
| Validation Architecture | V1–V10 + HI001–HI020 rules | implementation pending |
| Behavioral Acceptance | BA01–BA12 | executable scenarios pending |
| Host Projection | OpenCode boundary/capability target mapped | contract-backed registry pending |
| Migration Matrix | M0–M13 ordered plan | migration execution pending |
| Source Semantics | ADOPT/ADAPT/REJECT/HOLD register | architecture decision evidence |
| Engineering Constitution | V1 candidate | migration pending |
| ADRs | ADR-0001..0012 accepted | migration obligations active |

## Migration proof rows

Rows below are intentionally `PENDING` until code exists.

| Phase | Implementation | Required proof | Tier | Commit | Status |
|---|---|---|---|---|---|
| M0 | constitution documentation foundation | constitution lint PASS; validator PASS; diff check clean | T0 | `e03aefd` | PASS |
| M1 | common contract/provenance primitives | focused contract tests 6/6 PASS; controlled full suite 464/464 PASS; validator PASS; diff check clean; build generation idempotent | T0/T1 | pending | PASS — COMMIT PENDING |
| M2 | RoleContract owner/generator | BA01 + agent binding + role routing + full regression | T1/T2 | — | PENDING |
| M3 | PermissionProfile | safety monotonicity negatives + projection parity | T1/T2 | — | PENDING |
| M4 | MethodologyContract normalization | BA02 + 27-methodology parity + admission/load/exit tests | T1/T2 | — | PENDING |
| M5 | ConfigOption catalog | BA03 + config executor lint | T1/T2 | — | PENDING |
| M6 | Model capability/identity | BA04 + resolver/observed identity tests | T1/T2 | — | PENDING |
| M7 | Host capability registry | BA05 + doctor/degraded/unsupported tests | T2/T3 as applicable | — | PENDING |
| M8 | Task/Worker/Result/Evidence contracts | BA07–BA09 + recovery/team/task regression | T1/T2 | — | PENDING |
| M9 | Context/Artifact/PI/Human/Authority/Storage | BA06/10/11 + storage lint | T1/T2 | — | PENDING |
| M10 | common generator/lint closure | BA12 + HI001–HI020 migrated rules | T0/T1/T2 | — | PENDING |
| M11 | deterministic full closure | build + validator + full controlled suite | T0/T1/T2 | — | PENDING |
| M12 | real-host acceptance | OpenCode version-bound native receipts | T3 | — | PENDING |
| M13 | release readiness | explicit authority + external receipts | T4 | — | NOT REQUESTED |

### M1 implementation detail

Current implemented files:

- `plugin/src/contracts/common.ts` — strict common contract primitives, technical canonical IDs, deterministic canonical JSON, SHA-256 content/contract hashes;
- `plugin/src/contracts/provenance.ts` — strict ProvenanceRecord and deterministic ProjectionReceipt validation/generation;
- `plugin/test/contract-primitives.test.mjs` — deterministic ordering/hash and negative boundary tests.

Controlled full-suite environment explicitly uses isolated writable `HOME`, `XDG_STATE_HOME`, `XDG_DATA_HOME`, `XDG_CONFIG_HOME`, and `XDG_CACHE_HOME`. A direct server-default `/root` run produced permission-denied harness failures and is not product evidence. Under the controlled environment the suite is 464/464 PASS.

## Proof record format

Every future completed row records:

```text
phase
contract/ADR IDs
files changed
old owner removed/reclassified
commands/tests
pass/fail count
behavioral scenario IDs
evidence tier
known limitations
commit SHA
external actions performed (normally none)
```

## No-premature-completion rule

A document status such as `V1 TARGET ARCHITECTURE` or ADR `ACCEPTED` is **not** implementation evidence. Only this ledger plus executable tests/receipts may claim a migration phase complete.
