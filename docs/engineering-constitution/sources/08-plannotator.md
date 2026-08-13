# plannotator

Status: VERIFIED STUDY PASS 1

## Identity

- Canonical repository: `backnotprop/plannotator`
- Reference action: ADAPT

## Source surfaces inspected

- `apps/opencode-plugin/` implementation/test inventory, including CLI bridge, cancellation, commands, agent switching and embedded mode.

## Verified source facts

- OpenCode integration has dedicated bridge/cancellation/agent-switch boundaries and extensive plugin-level tests.
- Human plan annotation is implemented as an integration lifecycle, not only prompt prose.

## Useful engineering patterns

- Human decision UI/bridge state should have explicit cancellation/resumption semantics.
- Host interaction adapters deserve direct integration tests because process/UI lifecycle is different from semantic decision ownership.

## Foreign / accidental semantics to reject

- Hi should not force plan annotation for work that does not require human value judgment.
- UI-specific process architecture does not belong in Hi Core.

## Hi mapping

- HumanDecisionContract should separate semantic reason/options/authority from host UI projection and cancellation lifecycle.
