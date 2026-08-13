# opencode-pty

Status: VERIFIED STUDY PASS 1

## Identity

- Canonical repository: `shekohex/opencode-pty`
- Reference action: ADAPT

## Source surfaces inspected

- `src/plugin.ts`
- imported manager, permissions and `spawn/write/read/list/kill` tool boundaries.

## Verified source facts

- PTY capability is represented by real native plugin tools for spawn/write/read/list/kill.
- A manager owns PTY lifecycle and session deletion triggers cleanup by session.
- Permission initialization is separate from lifecycle management.
- Web UI lifecycle is optional and separate from the process tool contract.

## Useful engineering patterns

- Process lifecycle needs real process handles and explicit cleanup ownership.
- Session deletion should reconcile/cleanup owned runtime resources.
- Process management is a host capability, not a prompt promise.

## Foreign / accidental semantics to reject

- Hi must not spawn a parallel process runtime when OpenCode's normal bash primitive is sufficient.
- PTY UI/web-server details are not Hi Core semantics.

## Hi mapping

- Confirms the decision to mark generic `process_events` DEGRADED when the OpenCode adapter cannot observe PID/process lifecycle for ordinary bash.
- A future HostCapabilityAdapter may use PTY only when the user/task actually requires persistent interactive process control.
