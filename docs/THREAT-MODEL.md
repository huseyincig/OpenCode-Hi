# OpenCode-Hi Threat Model

Primary boundaries are host permission denial, external-action authority, provider-facing secret exposure, filesystem/path traversal, child control-plane recursion, stale evidence, user-owned dirty work, release supply-chain integrity, process cleanup, and untrusted execution.

Hi never expands host authority. Privileged external actions are bound to an exact action contract and explicit authority. Skill resources and archive extraction are path-confined. Provider task context is redacted locally. Evidence that covers changed state becomes stale. Worktree/process cleanup must preserve user-owned work. Release claims require exact candidate binding and deterministic artifact evidence.
