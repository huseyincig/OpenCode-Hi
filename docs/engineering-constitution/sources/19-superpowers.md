# obra/superpowers

Status: VERIFIED STUDY PASS 1

## Identity

- Canonical repository: `obra/superpowers`
- Role in constitution: methodology/harness engineering reference.

## Source surfaces inspected

- `docs/porting-to-a-new-harness.md`
- `skills/test-driven-development/SKILL.md`
- `skills/writing-skills/` structure and behavioral-testing references
- `skills/using-git-worktrees/`
- `skills/subagent-driven-development/SKILL.md`
- previously supplied `brainstorming`, `receiving-code-review`, worktree and authoring skill sources.

## Verified source facts

- Skill content is intended to be harness-agnostic; tool names are mapped at the harness boundary.
- A harness integration is not considered real unless bootstrap/discovery/invocation actually reaches the model.
- Missing host primitives degrade capabilities; integrations are instructed not to invent nonexistent tool calls.
- Skill authoring is treated as behavior-shaping engineering and is pressure-tested rather than accepted only by file/schema existence.
- Subagent methodology explicitly reasons about fresh context, review loops, task complexity, model tier and total turn cost.
- Worktree skill is a safe procedure for obtaining/validating isolation, not proof that a host can bind later execution to that workspace.

## Useful engineering patterns

- `methodology HOW` must be independent from `runtime WHETHER` and `host CAN`.
- Behavioral methodology acceptance: baseline gap -> methodology -> repeated scenario -> counterexample.
- Harness adapters translate abstract actions to actual primitives rather than editing methodology bodies per host.
- Model selection should optimize expected completion behavior/cost, not raw token price.

## Foreign / accidental semantics to reject

- Fixed Superpowers orchestration skills do not become Hi control-plane owners.
- Unconditional human approval rules are not adopted where they conflict with Hi authority/minimum-attention semantics.
- Strong prose mandates are not substitutes for machine-enforceable Hi authority or completion logic.

## Hi mapping

- Restore `hi-workspace-isolation` only as capability-gated HOW methodology; do not restore fake WorktreeRuntime.
- Enrich methodology authoring with behavioral proof.
- Preserve native lazy methodology load and host-agnostic methodology bodies.
