# OpenCode upstream

Status: VERIFIED STUDY PASS 1

## Identity

- Canonical repository: `anomalyco/opencode`
- Reference role: primary/reference host, not product ontology.

## Source surfaces inspected

- `packages/opencode/src/agent/agent.ts` on `dev`
- config service source around instance/global config state.

## Verified source facts

- OpenCode agent `Info` is schema-defined with name, description, mode, native/hidden flags, temperature/topP, permission ruleset, optional provider/model pair, variant, prompt/options and steps.
- Built-in agents are composed from default permission rules plus agent-specific permission overlays plus user config.
- `build`, `plan`, `general`, `explore`, `compaction`, `title`, and `summary` have materially different native modes/permissions/prompts.
- User-defined agent config overlays model, variant, prompt, mode, temperature, steps, options and permissions.
- Skill/reference directories are explicitly whitelisted for external-directory access in native agent permissions.

## Useful engineering patterns

- Host agent identity, mode, model/variant and permissions are real executable host facts and should be treated as an adapter projection.
- Permission composition and user overrides exist natively; Hi collision/parity checks must account for the actual host merge semantics.
- Hidden/internal agents show that host agent inventory is broader than Hi product roles.

## Foreign / accidental semantics to reject

- OpenCode built-in agent names (`build`, `plan`, `general`, etc.) do not define Hi Role ontology.
- Host config merging does not own Hi role, evidence, completion, authority or methodology semantics.

## Hi mapping

- `RoleContract` remains host-independent.
- `OpenCodeAgentProjection` must map a Hi role into valid OpenCode `Info` fields and mechanically verify actual binding.
- `HostCapabilityContract` should be derived from real OpenCode surfaces, not assumptions from historical versions.
