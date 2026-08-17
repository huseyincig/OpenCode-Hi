# Milestone 6 — Host/Plugin Composition Hardening

**Completed:** 2026-08-17
**Checkpoint:** commit containing this record (`architecture: harden OpenCode composition boundaries`)

## Result

- Added a narrow OpenCode composition adapter/probe instead of treating the whole host config as Hi-owned state.
- Current SDK/V1 compatibility projection mutates only explicit Hi leaves: canonical Hi agent registration, packaged skill path, project methodology permission projection, Hi namespace, and bounded authority narrowing.
- Removed unconditional ownership of OpenCode `default_agent` and global `subagent_depth`.
- Host-native/external primary agents can now start a Hi mission; host agent identity is decoupled from Hi's internal primary execution policy.
- Existing `plugin` order, provider/MCP/custom fields, external agents, external skill paths and host primary/depth values remain untouched.
- V2-shaped or mixed V1/V2 config is not backfilled with legacy V1 keys. The adapter returns deterministic `v2-domain-transform-required` / mixed-family diagnostics instead of pretending V1 config mutation is portable.
- Added an explicit capability selector seam: complete V2 agent/skill/permission transforms are preferred when available; current 1.18.18 remains on the V1 config-hook adapter.
- Same-name Hi agent composition is preflight-first and transactional: execution-semantic collisions do not partially inject other agents, skills or permissions.
- Compatible same-name agent metadata and permission narrowing are preserved by identity; prompt/mode/model/tool/disable/step-budget changes or permission widening are rejected as collisions.
- Project methodology permission projection distinguishes Hi-injected agents from pre-existing host/user agents without writing ownership markers into OpenCode config. Hi-injected default-deny may expose one admitted project methodology as ASK; pre-existing wildcard DENY remains DENY.
- Project authority permission merge is monotonic: specific user/plugin decisions are preserved; broad ASK/DENY are never widened; broad/default ALLOW may be narrowed to ASK for Hi-owned consequential external effects; persistent native approval may restore the exact external class to ALLOW; force-push remains separately bounded.
- Message/system/compaction transforms are additive/idempotent and preserve prior plugin output. Spoofed/conflicting Hi marker namespaces no longer suppress canonical projection; observable collisions are recorded as `host.composition-collision` without guessing competitor names.
- Doctor no longer describes `subagent_depth=1` as a Hi-owned host default.

## Current OpenCode source basis

Verified 2026-08-17 from current primary upstream and local SDK:

- project-local `@opencode-ai/plugin` is exactly `1.18.18`, the V1 config-hook compatibility target;
- current dev V1 permission engine uses ordered rules with last match winning and defaults to ASK only for selected sensitive operations while otherwise allowing by default;
- current dev V2 config redesign removes `default_agent`, renames/restructures agent/plugin/provider/permission/skill surfaces and moves toward domain transforms/registrations with deterministic plugin ordering;
- current V2 session permission service defaults to ASK when no rule matches, so V1 permission defaults must never be projected into V2 by assumption;
- native skill discovery/loading remains a host capability; M6 only preserves the current V1 packaged-path compatibility seam.

Primary references:
- https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/permission/next.ts
- https://github.com/anomalyco/opencode/blob/dev/specs/v2/config.md
- https://github.com/anomalyco/opencode/blob/dev/specs/v2/instructions.md
- https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/session/permission.ts
- https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/config/config.ts

## Verification

- composition/primary/coexistence targeted set: **50/50 PASS**
- transform/collision/methodology targeted set: **40/40 PASS**
- authority + hostile methodology focused regression: **33/33 PASS**
- full plugin suite: **932/932 PASS**, 0 fail, 0 cancelled
- architecture lint: **22/22 PASS**
- TypeScript build: PASS
- scoped `git diff --check`: PASS

## Important boundaries

- No competitor/plugin-name blacklist was introduced. V1 does not expose other plugins' hook ownership strongly enough to infer semantic conflicts from names; only observable namespace/config collisions are diagnosed.
- No V2 transform execution is falsely claimed under the current 1.18.18 plugin API. The capability/probe seam is ready for a real V2 adapter when those hooks are the active host surface.
- `default_agent` and `subagent_depth` may still be observed for diagnostics/capabilities but are no longer written by Hi.
