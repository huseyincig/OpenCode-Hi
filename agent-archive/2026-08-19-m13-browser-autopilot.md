# M13 — Browser Autopilot Completion — 2026-08-19

**Status:** COMPLETE
**Final retained product commit:** `e0cb30f82947a22f0bedec4c69a9da1cf4f0ee1b`
**OpenCode runtime:** `1.18.18`

## Outcome

M13 evolved the existing bounded Playwright adapter into task-aware browser orchestration without adding a second browser engine or orchestration runtime. The retained path now has exact task/attempt ownership and cleanup, task/runtime backend selection, exact-origin confinement, observation-linked evidence, and same-task browser-to-code correction semantics.

## Retained product cutovers

1. `7658f104ab1c2c2a818e9ca6ea5758c8e391d491` — `runtime: clean task-owned browser sessions`
   - terminal/cancel/rebase cleanup closes only the exact owned browser session;
   - stale generation/owner cleanup cannot close a replacement session.
2. `3856397af697eca287bd357a6441b495e99c5817` — `runtime: select task-bound browser backend`
   - healthy bounded Playwright remains the default local visual backend;
   - explicitly selected configured MCP can be native-authoritative without dual browser surfaces;
   - browser backend is not inferred merely from MCP server names.
3. `e2421b9b5fd22d3eba7120b6092afd1fe8167014` — `runtime: confine browser task origins`
   - task browser origin set is explicit and bounded;
   - direct and click-induced cross-origin navigation fail closed.
4. `23f27bef042c7b78eae08d91bde3113f94fd7d6b` — `runtime: bind browser evidence to observations`
   - visual evidence must cite a canonical current-attempt browser observation;
   - stale or ref-less visual PASS cannot satisfy the claim.
5. `e0cb30f82947a22f0bedec4c69a9da1cf4f0ee1b` — `runtime: preserve browser methodology on correction`
   - actionable browser findings resume the same task/worker session correction path;
   - earlier attempt observations become stale rather than being reused as fresh proof.

## Mechanical acceptance evidence

- Task-owned cleanup comparator: `/workspace/Reference/phase2-autopilot/m13-browser-cancel-comparator.json`, SHA-256 `4dc748b686697572c2d8ca009faa73803228c83405d377887f9f75c4b162b744`; baseline leakage `3/3`, retained cleanup `3/3`, real browser health `3/3`.
- Backend real-host comparator: `/workspace/Reference/phase2-autopilot/m13-browser-backend-realhost-aggregate.json`, SHA-256 `6d4a75200548a75daf767f4a099791f6e52326a7c06ce7442d94c677000dfaa4`; selected MCP is native-authoritative `3/3` and candidate avoids dual local/MCP browser exposure.
- Origin comparator: `/workspace/Reference/phase2-autopilot/m13-browser-origin-comparator-aggregate.json`, SHA-256 `fd2acab330641d963848be48e374bb1aa50987a0b7b5462c6ec15621dc6d2938`; baseline cross-origin succeeds while retained direct and click navigation are blocked `3/3`.
- Evidence provenance comparator: `/workspace/Reference/phase2-autopilot/m13-browser-evidence-provenance-aggregate.json`, SHA-256 `82923c4ee69dcc13ebeef3a585927527363a22b391b61c2fa841cc0607aba22d`; candidate `4/4 PASS`, baseline exposes the intended gap `0/4`.
- Browser feedback comparator: `/workspace/Reference/phase2-autopilot/m13-browser-feedback-loop-aggregate.json`, SHA-256 `73afa336d50c74af64fcde4077867d90aaafca007c1d11bf23365d0b1e9fc8e3`; candidate keeps same task/worker correction ownership and stales prior proof.

## Lightweight backend context economics

Current official upstream behavior was rechecked before acceptance closure:

- OpenCode MCP tools participate in the model tool/context surface and its official docs warn that enabling many MCP tools increases context usage.
- Microsoft Playwright MCP currently recommends CLI/skills for coding-agent workloads where loading large MCP tool schemas is unnecessary, while MCP remains useful for persistent state and iterative browser workflows.
- Exact fixture package: `@playwright/mcp` `0.0.79`, package SHA-256 `f42e3f730da45db21bd2edfb01679a6a33a56126514dae09444d2ca88123ef8b`.

Mechanical comparator: `/workspace/Reference/phase2-autopilot/m13-browser-context-economics-aggregate.json`, SHA-256 `763f3564491bdb2e477c43e85fb9f12e8fe7d79ecdd562548585a96ee928d15d`.

- exact retained bounded Playwright backend: `8` browser tools, `2626` normalized serialized schema bytes;
- current Playwright MCP: `24` browser tools, `15921` normalized serialized schema bytes;
- MCP list-tools hash stable across `3/3` independent stdio handshakes;
- bounded backend-specific schema surface is `13295` bytes smaller, an `83.51%` reduction versus this MCP fixture;
- backend policy selects `bounded-playwright` for the representative local lightweight visual task.

This metric is deliberately bounded: it is a provider tool-schema/context-load proxy in UTF-8 bytes. It is **not** model-token accounting, provider-billed cost, or a claim that bounded Playwright is always preferable. Stateful/persistent browser tasks may correctly select MCP when task/runtime evidence justifies it.

Runner: `/workspace/Reference/phase2-autopilot/run_m13_browser_context_economics.mjs`, SHA-256 `312556964bc0aff8d85d15561ce64b3c8c34e62d071338ff94c8a34008d180de`.

## Exact final verification

Immutable image: `/workspace/Reference/phase2-autopilot/opencode-hi-e0cb30f82947a22f0bedec4c69a9da1cf4f0ee1b`.

- build PASS; log SHA-256 `f1d963ec4ae1a5f8d0bf0beabd20fdf4a2fd4f2093fb391f51461d41b5363e80`;
- architecture lint `22/22 PASS`; log SHA-256 `179c0c2342de88218e68c8cdff8978d1d633faa88b2cd9bc99c1f476e3d8f973`;
- plugin suite `1003/1003 PASS`; log SHA-256 `120af3629fcc7aa8ae58e4a3051ab6ecb1db773b4034d2bfd7ec4f8e1d23a403`.

## Claim boundary

M13 proves bounded browser orchestration semantics and the measured context-surface advantage of the lightweight backend for the tested stateless/local task class. It does not claim a generic browser engine, generic MCP inferencing, global browser performance superiority, token billing savings, or provider-cost savings.
