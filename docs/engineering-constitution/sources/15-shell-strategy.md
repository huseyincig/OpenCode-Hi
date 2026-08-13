# opencode-shell-strategy

Status: VERIFIED STUDY PASS 1

## Identity

- Canonical repository: `JRedeker/opencode-shell-strategy`
- Reference action: ADAPT

## Source surfaces inspected

- `shell_strategy.md`
- repository test/package inventory.

## Verified source facts

- Policy distinguishes authorized non-interactive rewrite, fail-fast non-interactive execution, and stop-for-user-action.
- It explicitly rejects blanket `yes | ...` and unsafe SSH host-key bypass.
- Command-specific flags are preferred to generic force; credential prompts should fail visibly.

## Useful engineering patterns

- Shell policy outcomes should be typed: ALLOW/REWRITE/USER_ACTION_REQUIRED/DENY.
- Rewrite is valid only when the underlying action is already authorized.
- Non-interactivity and authority are separate concerns.

## Foreign / accidental semantics to reject

- Instruction prose alone is insufficient enforcement for Hi.
- Example command table is not a universal semantic classifier.

## Hi mapping

- Current Hi `tool.execute.before` shell gate is the correct executor location.
- Future ShellCommandPolicy contract should separate technical command facts from user-action authority.
