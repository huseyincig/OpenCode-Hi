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
| M1 | common contract/provenance primitives | focused contract tests 6/6 PASS; controlled full suite 464/464 PASS; validator PASS; diff check clean; build generation idempotent | T0/T1 | `3809cd1` | PASS |
| M2 | RoleContract owner/generator | role identity/mode/description/runtime catalog and methodology permission contribution are canonical-data driven; focused projection suite 24/24 PASS; controlled full suite 467/467 PASS; validator PASS | T1/T2 | pending | ACTIVE — GENERAL PERMISSION PROFILE NEXT |
| M3 | PermissionProfile | safety monotonicity negatives + projection parity | T1/T2 | — | BLOCKED — SENTINELX POLICY PREVENTED PERMISSION-CATALOG MUTATION |
| M4 | MethodologyContract normalization | mechanical SKILL contract sections compiled from canonical JSON; inert duplicated fields removed; focused 37/37 PASS; controlled full suite 469/469 PASS; validator PASS | T1/T2 | pending | ACTIVE — MECHANICAL OWNER MIGRATED |
| M5 | ConfigOption catalog | BA03 + config executor lint | T1/T2 | SentinelX blocks direct config-catalog mutation in this environment | BLOCKED_BY_HOST_POLICY |
| M6 | Model capability/identity | ModelCapabilityProfile host-inventory normalization + identity reconciler + effective-model evidence; focused 17/17 PASS; controlled full suite 475/475 PASS; validator PASS | T1/T2 | requested/projected WorkerState snapshot wiring blocked by SentinelX mutation policy; no unwired state committed | PARTIAL_PASS |
| M7 | Host capability registry | BA05 + doctor/degraded/unsupported tests | T2/T3 as applicable | — | PENDING |
| M8 | Task/Worker/Result/Evidence contracts | BA07–BA09 + recovery/team/task regression | T1/T2 | — | PENDING |
| M9 | Context/Artifact/PI/Human/Authority/Storage | BA06/10/11 + storage lint | T1/T2 | — | PENDING |
| M10 | common generator/lint closure | BA12 + HI001–HI020 migrated rules | T0/T1/T2 | — | PENDING |
| M11 | deterministic full closure | build + validator + full controlled suite | T0/T1/T2 | — | PENDING |
| M12 | real-host acceptance | OpenCode version-bound native receipts | T3 | — | PENDING |
| M13 | release readiness | explicit authority + external receipts | T4 | — | NOT REQUESTED |



### M3 host-policy blocker

PermissionProfile implementation was attempted only after current role permission maps were inventoried and an exact-preservation profile design was prepared. SentinelX blocked creation/mutation of permission-catalog data and direct removal of existing role permission blocks. No bypass was attempted. M3 remains open; current runtime permission behavior is unchanged.

### M4 methodology projection checkpoint

Implemented:

- removed `escalation_relation` and `verification_relation`, which were identical prose repeated across all 27 methodologies and had zero production consumers;
- added `scripts/generate_methodology_skills.py`, which preserves the human-authored title and `Method` body while compiling frontmatter and mechanical Contract fields from `data/hi-methodologies.json`;
- linked the compiler into methodology policy generation;
- added tests proving SKILL name/purpose/trigger/negative-trigger/exit/role-affinity/context-cost/execution-cost projections exactly mirror canonical methodology data;
- preserved methodology count/names, selected-vs-loaded behavior, project admission/collision/provenance, runtime activation and role-native methodology reachability.

Evidence: focused methodology suite 37/37 PASS; controlled isolated-HOME/XDG full suite 469/469 PASS; validator PASS; diff check clean.

### M2 projection checkpoint

The OpenCode agent projection now derives `description` and `mode` from `data/hi-roles.json`, injects a generated RoleContract purpose/use/do-not-use preamble into the agent prompt, and derives native methodology skill permissions from `data/hi-methodologies.json` compatible-role relationships. `scripts/generate_methodology_policy.py` validates compatible role references against the canonical role catalog rather than treating Markdown skill permissions as an owner.

The remaining mechanical role frontmatter surface is the general OpenCode permission/prompt guidance projection that M3 will normalize through PermissionProfile. Existing `permission.skill` text remains physically present in `roles/*.md` because SentinelX blocked direct edits to those blocks; it is not consumed as runtime truth by the generator. This residue must not be mistaken for a second canonical owner.

Evidence: focused role/methodology/agent projection suite 24/24 PASS; controlled full suite 467/467 PASS; validator PASS; diff check clean.

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


### M6 checkpoint evidence

- Runtime provider inventory is normalized through `ModelCapabilityProfile` before routing.
- Explicit model capability quirk metadata overrides technical model-ID fallback heuristics.
- `ModelExecutionIdentity` distinguishes requested, selected, projected, observed, effective, and verified phases without persisting producerless runtime fields.
- Focused controlled model suite: **17/17 PASS**.
- Controlled full suite: **475/475 PASS**.
- Standalone validator: **PASS**.
- Remaining runtime snapshot wiring is explicitly deferred because the connected host policy rejected that mutation.
