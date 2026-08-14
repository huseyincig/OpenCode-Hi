# 09 — Generator / Projection Architecture

Status: V1 OPERATIONAL FOR MIGRATED PROJECTIONS — M3/M5/M6 RESIDUE REMAINS EXPLICIT

## Purpose

Define how canonical Hi contracts become generated runtime/host artifacts without allowing generated files, prompts or host frontmatter to become a second semantic owner.

## M10 operational generator graph

The local deterministic build now uses one composed projection/check graph rather than treating the existing generators as unrelated utilities:

```text
data/hi-roles.json + roles/*.md guidance
        -> generate_role_policy.py
        -> generate_plugin_agents.py

data/hi-methodologies.json + authored SKILL Method bodies
        -> generate_methodology_skills.py
        -> generate_methodology_policy.py

all material generated outputs
        -> postbuild generate_projection_receipts.mjs
        -> data/validation/projection-receipts.json
        -> architecture_lint.mjs projection/source/output parity
```

`plugin/package.json` owns the deterministic order: prebuild projections -> TypeScript build -> postbuild receipts. Root/plugin `check` then runs architecture lint before the controlled behavioral suite. The receipt catalog contains one canonical `ProjectionReceipt` per material generated runtime TS projection and native methodology `SKILL.md` projection; it reuses the M1 `ProjectionReceipt` contract rather than introducing a second receipt schema.

BA12 is executable in `plugin/test/generator-idempotence.test.mjs`: identical input produces byte-identical output on a second generation pass, and a one-field RoleContract purpose mutation changes only the declared role-policy + agent-config dependent projections in an isolated fixture.

The generator graph intentionally does **not** claim M3 PermissionProfile or M5 ConfigOption ownership. Existing role Markdown permission residue remains an explicitly reclassified M3 parity surface until the prior host-policy blocker can be removed safely.

## Current verified generator reality

### Methodology path — canonical mechanical projection operational

Current chain:

```text
data/hi-methodologies.json
        +
skills/<name>/SKILL.md contract/body
        +
roles/*.md native skill permissions
        ↓
scripts/generate_methodology_policy.py
        ↓
plugin/src/generated/methodology-policy.ts
        ↓
runtime methodology consumers
```

The generator already validates:

- schema version and methodology limits;
- unique methodology IDs;
- packaged skill inventory parity;
- activation signal catalog ownership;
- exit requirement catalog ownership;
- compatible/preferred role coherence;
- role native methodology permission parity;
- SKILL.md description/trigger/do-not-trigger/exit/role-affinity parity;
- duplicate Method bodies.

This is a strong base but still has **multiple authored surfaces** (`data`, `SKILL.md`, `roles/*.md`) that the generator reconciles rather than deriving all mechanical projections from one contract.

### Role/agent path — Role identity migrated; M3 permission residue remains

Current chain:

```text
roles/*.md frontmatter + prompt body
        ↓
scripts/generate_plugin_agents.py
        ↓
plugin/src/generated/agent-config.ts
        ↓
bindHiOpenCodeAgents()
        ↓
OpenCode config.agent
```

`roles/*.md` currently mixes:

- Hi semantic role guidance;
- OpenCode-specific mode/permission fields;
- methodology permission projection;
- child/primary execution settings;
- model-facing prompt body.

Therefore it is both authoring document and host projection source. This violates the target ontology where Role != Agent and host frontmatter != canonical product contract.

## Target source-of-truth graph

```text
contracts/catalogs/roles.*          contracts/catalogs/methodologies.*
          │                                      │
          ├──────────────┬───────────────────────┤
          │              │                       │
          ▼              ▼                       ▼
 Role human doc     OpenCode agent          Methodology human body/resources
 projection          projection                    │
          │              │                         ▼
          │              └──────────────► native skill projection/permissions
          │                                        │
          └────────────────────┬───────────────────┘
                               ▼
                    generated projection receipts
                               ▼
                   runtime generated TS catalogs
```

The exact storage format may be JSON/JSONC/YAML/TS according to implementation ergonomics, but semantic direction is fixed.

## Generator classes

### G01 — RoleProjectionGenerator

**Input:** RoleContract + PermissionProfileContract + methodology compatibility + optional model/default host policy.

**Outputs:**

- human-readable role Markdown/prompt projection;
- OpenCode agent projection containing only host-valid fields;
- runtime TypeScript Role catalog;
- projection receipt with contract ID/hash and output hashes.

**Must not:** parse generated role Markdown as the canonical role definition after migration.

### G02 — MethodologyProjectionGenerator

**Input:** MethodologyContract + resource manifest + role compatibility.

**Outputs:**

- `SKILL.md` or equivalent native-host methodology projection;
- runtime methodology policy TS;
- role native-skill permission contributions;
- projection receipt.

Model-facing Method section may be authored through T02 and compiled into the native skill body. Trigger/exit/role/capability facts come from the contract, not separately maintained prose.

### G03 — PermissionProjectionGenerator

**Input:** PermissionProfile + Role contract + host capability/adapter rules.

**Output:** host-native permission map.

Composition order must be explicit and safety-monotonic. Project methodology permission extensions are admitted through project methodology policy, not arbitrary host config widening.

### G04 — ModelRoutingProjectionGenerator

Generates runtime resolver inputs or derived indexes from ModelCapabilityProfiles. It never bakes model IDs into role prompts.

### G05 — DocumentationProjectionGenerator

Generates repetitive catalogs/tables/reference docs from schemas/contracts. Handwritten architecture docs remain for rationale/invariants.

### G06 — ProjectionReceiptGenerator

For every material generated artifact, record:

```text
projection_schema
source_contract_ids[]
source_contract_hashes[]
generator_id/version
output_path
output_hash
generated_at or deterministic build metadata policy
```

Generated timestamps should be omitted when they would make deterministic builds noisy and serve no lifecycle purpose.

## Determinism requirements

Given identical canonical inputs and generator version:

```text
output bytes MUST be identical
```

Requirements:

- stable key ordering;
- stable catalog ordering;
- no ambient locale dependence;
- no current-time field unless excluded from canonical parity/hash;
- no network lookup during ordinary generation;
- no model call during canonical mechanical generation;
- no filesystem discovery outside explicit component roots/manifests.

LLM assistance may help author a DRAFT contract, but admitted canonical generation is deterministic.

## Generated-file policy

Generated artifacts:

- are marked `DO NOT EDIT` where format permits;
- are regenerated during build/check;
- fail CI/local validation when dirty relative to canonical inputs;
- carry or have a sidecar receipt;
- are classified DERIVED;
- are never the only storage location of a semantic field.

## Build integration

Target build order:

```text
1. parse/validate canonical contracts
2. referential-integrity validation
3. generate projections
4. assert generated tree clean/idempotent
5. TypeScript build
6. projection parity tests
7. behavioral tests
```

Today `npm prebuild` generates agent/methodology TS. During migration this hook becomes the integration point for the common contract generator rather than accumulating independent scripts.

## Current migration obligations

1. introduce canonical RoleContract data without changing the eight-role behavior;
2. migrate mechanical role frontmatter fields out of `roles/*.md` ownership;
3. retain role Markdown only as a generated/human guidance projection;
4. convert methodology structured fields to a single canonical contract while preserving the 27 current methodologies;
5. derive role methodology permissions rather than requiring manual parity across role frontmatter;
6. generate `runtime/roles/catalog.ts` from RoleContract instead of hand-maintaining role arrays/obligation maps;
7. generate/validate OpenCode agent projection against actual host-compatible schema;
8. add projection receipts/hashes;
9. remove old generator ownership only after parity and behavior pass.

## Anti-patterns forbidden by the generator architecture

- generator reads a generated artifact as its source of truth;
- two generators independently decide the same permission/role/methodology fact;
- role Markdown manually adds a methodology permission;
- runtime hard-coded role arrays diverge from RoleContract;
- hand-editing `plugin/src/generated/*`;
- LLM-generated canonical host config without deterministic validation;
- compatibility output silently retained after canonical contract removes it.
