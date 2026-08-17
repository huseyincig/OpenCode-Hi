# OpenCode-Hi Active Task State

**Project:** `/workspace/OpenCode-Hi`
**Status:** ACTIVE — ROADMAP MILESTONE 6
**Updated:** 2026-08-17
**Global authority:** `/workspace/PROTOCOL.md`
**Legacy project-policy layer:** `/workspace/OpenCode-Hi/PROTOCOL.md`
**Roadmap:** `/workspace/OpenCode-Hi/ROADMAP.md`

## Active Task

### Milestone 6 — Host/Plugin Composition Hardening

Make Hi coexist with OpenCode and other plugins/skills instead of owning shared host configuration, while retaining Hi control-plane semantics behind capability adapters.

## Verified Baseline

Milestone 5 is complete; see `agent-archive/2026-08-17-semantic-progress-recovery-economics.md`. Semantic progress is runtime-owned, repeated same-state recovery is fenced, unknown consequential outcomes block replay, usage/economics provenance is explicit, and model feedback is bounded/current-mission with exact-attempt evidence attribution. Full plugin suite passed 916/916 with architecture lint 22/22.

## Scope

1. Inspect `open-code-hooks.ts` / config hooks and identify every shared OpenCode config mutation Hi currently owns.
2. Separate required Hi projection from unnecessary host ownership (`default_agent`, broad agent catalog/global names, `subagent_depth`, skill paths, permissions, MCP/provider/plugin fields).
3. Preserve unknown-but-host-valid fields and existing plugin/user ordering; no lossy re-modeling of OpenCode config.
4. Add stable 1.18.18 SDK/config compatibility probes plus current dev/V2 capability/transform probes without shaping Hi Core around either API.
5. Prefer scoped transform/registration seams when available; retain a narrow V1 compatibility adapter where required.
6. Preserve native permission inheritance and never widen another plugin/user's authority.
7. Detect/report namespace or mutually exclusive transform/context ownership collisions rather than silently overriding them.
8. Add representative coexistence tests using external-agent/plugin/MCP/provider/skill/config shapes.

## Acceptance Criteria

- unrelated OpenCode config survives Hi configuration byte/semantic-equivalently except for explicitly owned Hi projection leaves;
- Hi does not unconditionally take ownership of `default_agent` or unrelated global agent/plugin/provider/MCP configuration;
- existing user/plugin permission restrictions are preserved or narrowed, never widened;
- external agents/plugins/skills remain usable unless an explicit proven collision exists;
- V1 compatibility and current dev/V2 transform capability are isolated behind host adapter/probe seams;
- config/order/collision diagnostics are deterministic and tested;
- full relevant plugin suite, TypeScript build and architecture lint pass.

## Constraints

- Preserve unrelated user-owned dirty files exactly.
- Do not reset/clean the working tree.
- Do not touch release/publication validation artifacts.
- No push/tag/release/npm publication.
- Do not redesign scheduler/evidence/progress economics in this milestone.
- Do not copy OpenCode config schema into Hi as a competing source of truth.
- Native-first, not native-dependent: host evolution must change adapters/probes, not Hi core semantics.

## Required Verification

- config-hook coexistence tests with unknown valid fields;
- multi-plugin ordering/agent/permission tests;
- skill/MCP/provider preservation tests;
- V1/current SDK compatibility tests and dev/V2 capability probe tests;
- collision diagnostic tests;
- full plugin test suite after cutover;
- TypeScript build, architecture lint and scoped diff inspection.

## Exact Next Action

Inspect current config/open-code hook implementation (`plugin/src/open-code-hooks.ts` or actual current equivalent), generated agent/skill projection, config mutation tests and OpenCode SDK 1.18.18 config types. Mechanically inventory every key Hi mutates and classify it as REQUIRED PROJECTION, NARROWING POLICY, or UNNECESSARY HOST OWNERSHIP before changing code. Reconcile the seam with current `anomalyco/opencode` dev/V2 config transform/registration source before implementation.
