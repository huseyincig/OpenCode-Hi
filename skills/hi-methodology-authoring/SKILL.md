---
name: hi-methodology-authoring
description: Create or evolve reusable Hi methodologies from explicit demand or repeated project evidence.
---

# Methodology Authoring

## Contract

- **Trigger:** A reusable way of working is explicitly requested or repeated project evidence shows a methodology gap.
- **Do not trigger:** One-off facts/evidence, project knowledge, control-plane policy, or an existing methodology already covers the need.
- **Exit condition:** Methodology contract, role compatibility, admission policy, provenance, resources, and validation are coherent and non-duplicative.
- **Role affinity:** coder
- **Context cost:** medium
- **Execution cost:** medium

## Method

1. Prove the candidate is reusable methodology rather than project knowledge, temporary evidence, or orchestration policy.
2. Search the built-in and admitted project methodology catalog before creating anything. Prefer evolving an existing methodology when the contract genuinely overlaps.
3. For project-specific methodology, use the canonical name `hi-project-<purpose>` and create the native skill at `.opencode/skills/<name>/SKILL.md` with only methodology content and bounded resources.
4. Create the Hi admission policy at `.opencode/hi/policy/methodologies/<name>.json` and provenance at `.opencode/hi/provenance/methodologies/<name>.json`. Do not auto-admit an unproven or colliding methodology.
5. Define trigger, do-not-trigger, exit condition, preferred/compatible roles, canonical activation signals, supported exit-requirement classes, cost, conflicts/coexistence, and evidence-backed provenance. Do not create a second trigger-source truth; trigger source is derived from the canonical signal catalog.
6. Choose exit requirements only from the canonical Hi exit-requirement catalog and distinguish worker-owned evidence from mission-owned evidence. A project methodology that cannot state how its exit is deterministically observed is not admissible.
7. Validate that the native skill, admission policy, provenance, role permissions, activation signals, and exit requirements agree. The methodology becomes eligible for Hi auto-selection only after the complete contract validates.
8. Keep normal activation lazy: catalog metadata may be inspected cheaply, but the SKILL.md body and resources are loaded only when Hi selects the methodology and OpenCode invokes the native skill tool.

## Ownership boundary

This methodology may author methodology artifacts. It does not decide mission topology, models, authority, obligation completion, continuation, or STOP. It does not promote project facts into methodology without reusable procedural evidence.
