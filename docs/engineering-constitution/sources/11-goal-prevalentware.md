# opencode-goal-plugin (Prevalentware)

Status: VERIFIED STUDY PASS 1

## Identity

- Canonical repository: `prevalentWare/opencode-goal-plugin`
- Reference action: ADAPT

## Source surfaces inspected

- `src/state.ts`
- source inventory: `server.ts`, `prompts.ts`, `tui.ts`.

## Verified source facts

- Goal state is a versioned schema with explicit status, budgets, usage, continuation state, no-progress state, history and checkpoints.
- Persistence uses schema decoding, bounded defaults, temporary-file write + rename, restrictive permissions and explicit error classes.
- No-progress and continuation state are persisted rather than relying on conversation memory.

## Useful engineering patterns

- Durable state must be schema-validated on load and written atomically.
- Continuation/no-progress identity should survive restart.
- History/checkpoints are bounded rather than unbounded transcript replication.

## Foreign / accidental semantics to reject

- Do not duplicate MissionState with a second goal state machine.
- Numeric default thresholds are source-specific heuristics, not Hi invariants.

## Hi mapping

- Reinforces RuntimePersistence exact-schema fail-closed behavior and bounded ledger/checkpoint concepts.
- RecoveryContract should state which progress/attempt fields are durable.
