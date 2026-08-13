# OpenCode-goal-plugin (willytop8)

Status: VERIFIED STUDY PASS 1

## Identity

- Canonical repository: `willytop8/OpenCode-goal-plugin`
- Reference action: ADAPT

## Source surfaces inspected

- `src/completion-claim.js`
- source inventory: `goal-plugin.js`, `persistence-lease.js`, `native-agent-config.js`, `opencode-session-api.js`.

## Verified source facts

- Completion claims are treated as untrusted boundary input and structurally validated before entering verifier/goal state.
- Completion schema bounds summary, criteria, checks, changed files and limitations.
- Every criterion must carry evidence; a failed check cannot appear in a valid completion claim; not-run is represented explicitly.
- Persistence/lease and native agent/session concerns are separate source modules.

## Useful engineering patterns

- Completion input must be validated before it can mutate canonical mission state.
- `passed | failed | not-run` is superior to collapsing unexecuted validation into success.
- Bounded evidence payloads reduce context/state abuse.

## Foreign / accidental semantics to reject

- Hi completion authority remains deterministic Mission/Obligation/Evidence reconciliation, not a worker completion claim.
- Do not copy global goal orchestration ownership where Hi already has MissionState.

## Hi mapping

- WorkerResult should be treated as untrusted input to deterministic completion, which current Hi already does.
- VerificationEnvelope/CompletionClaim contracts should make `not_run` and limitations explicit.
