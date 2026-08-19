# OpenCode-Hi Active Task State

**Project:** `/workspace/OpenCode-Hi`
**Status:** ACTIVE — PHASE 2 / MILESTONE 13
**Updated:** 2026-08-19
**Global authority:** `/workspace/PROTOCOL.md`
**Project policy:** `/workspace/OpenCode-Hi/PROTOCOL.md`
**Roadmap:** `/workspace/OpenCode-Hi/ROADMAP.md`

## Active Task

### M13 — Browser Autopilot

M12 is complete. Archive: `agent-archive/2026-08-19-m12-capability-isolation-intelligence.md`. Final retained M12 product commit is `72c71504be3b71e82cd45837c0c1db13af68aa7f`; exact isolated build/architecture/plugin verification is `990/990 PASS`.

M13 must evolve the existing bounded visual-verification browser executor into task-aware browser orchestration without building another browser engine. Backend choice must remain native-first/hybrid, task-bound, permission-safe, evidence-producing and cheaper only where measured.

## M13 Acceptance

- backend policy chooses among existing bounded Playwright execution, OpenCode/MCP/native host capabilities, or another justified adapter from task/runtime evidence rather than a fixed browser backend;
- route/navigation/action planning stays bounded by the exact task objective and allowed origins;
- browser session/attempt ownership, cleanup and recovery cannot leak across tasks or generations;
- DOM/text/screenshot/network/console observations remain bounded artifacts and become claim-linked evidence only through canonical evidence ownership;
- browser→code feedback does not create a second task/orchestration runtime or bypass Hi completion/authority;
- browser isolation is used only when state/cookie/concurrency semantics justify it;
- retained changes improve deterministic correctness/predictability or measured browser-task economics without weakening M12/Phase 1 invariants.

## Required Verification

- characterize current browser executor/ownership/tool exposure and exact OpenCode `1.18.18` host/browser/MCP seams before changing product behavior;
- use current official upstream research where browser/MCP/native behavior may have changed;
- focused browser ownership/evidence/session cleanup tests plus real browser/runtime probes for every retained backend seam;
- repeated hash-bound comparator for any backend-selection or browser-autopilot policy cutover;
- architecture lint + exact isolated full plugin suite for retained product-code changes;
- preserve unrelated dirty validation/release/script/routing/test files.

## Exact Next Action

Characterize the retained browser stack on exact commit `72c7150`: `runtime/browser/executor`, browser ownership/tool guards, Playwright adapter, artifact/evidence boundary, visual-qa methodology/resource admission, and current OpenCode `1.18.18` MCP/native tool primitives. Build a task-class matrix for lightweight local visual verification vs persistent/stateful browser work, then define the smallest repeated real-browser comparator before changing backend-selection behavior. Do not turn M13 into a generic browser engine rewrite.
