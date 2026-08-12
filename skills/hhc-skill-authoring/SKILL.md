---
name: hhc-skill-authoring
description: Use when creating, revising, validating, or reviewing HHC SKILL.md methodology files and their discovery/routing behavior.
---

# Skill Authoring

Create small discoverable methodologies that improve worker behavior without becoming a second control-plane.

## Method
1. Write a precise frontmatter `name` and a description that states triggering conditions, not the whole workflow.
2. Keep the body focused on a reusable engineering method, with explicit when-not-to-use boundaries.
3. Never encode task routing, worker spawning, model selection, continuation, authority, or STOP ownership inside a skill.
4. Prefer deterministic/runtime policy for enforceable invariants; skills should supply methodology only.
5. Add discovery/routing tests proving the skill is selected only for intended capabilities and default-zero remains intact.
6. Keep skill content bounded enough for child-specific loading and context budgets.

When modifying an existing skill, preserve its contract unless the routing tests and intended trigger are deliberately updated together.
