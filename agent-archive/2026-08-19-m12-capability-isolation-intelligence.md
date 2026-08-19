# M12 — Capability & Isolation Intelligence

**Completed:** 2026-08-19
**Project:** `/workspace/OpenCode-Hi`
**Final product commit for M12:** `72c71504be3b71e82cd45837c0c1db13af68aa7f`

## Outcome

M12 is complete. OpenCode-Hi now keeps capability choice task-bound while reusing OpenCode-native primitives: ordinary bounded commands remain native shell, persistent/interactive lifecycle is gated into the native PTY owner, isolated write tasks reintegrate through native workspace warp, configured MCP servers are exposed by exact server scope without Hi-generated permission allows, and the existing bounded browser owner remains unchanged for visual/browser verification. No duplicate generic process/workspace/MCP/browser engine was added.

## Retained product changes

- `9d051eaed2f0c911ee109ca56ba73ca92b0f3945` — native workspace reintegration for exact isolated write tasks; cleanup remains fail-closed.
- `a3a02ee6abd12ff6010b596543eddf5536074204` — persistent/interactive process lifecycle becomes an explicit semantic capability; bounded commands remain native shell.
- `51552ea6900e64fb95711b79e2a7943f1f7a401c` — configured MCP exposure is server-scoped with native wildcard deny for unselected servers; selected servers are left to native permission authority and Hi never emits an allow-true widening.
- `72c71504be3b71e82cd45837c0c1db13af68aa7f` — semantic gate explicitly separates capability IDs from methodology intent signals after repeated real-model invalid-assessment evidence.

## Workspace evidence

`M12_WORKSPACE_REINTEGRATION_AGGREGATE` on OpenCode `1.18.18`:

- baseline `3/3` successful cleanup but `0/3` primary reintegration;
- candidate `3/3` successful exact applied file, session detach and clean worktree registry;
- candidate mean wall delta `+2.48%`, so retention is for semantic correctness/predictability rather than speed;
- aggregate SHA-256 `0f238e05a4829dd99ef92fc64ff89633b802ee157ab930aec4c33e9cf4dea4c1`.

Decision: **RETAIN_NATIVE_WARP_REINTEGRATION_FOR_ISOLATED_WRITE_TASKS**. This does not authorize generic isolation.

## Process evidence

- Real OpenCode `1.18.18` PTY probe observed native PTY health, spawn, bounded output, exit and cleanup path; receipt SHA-256 `4379d5a291f203541c606bf6d67de056152ee4026734494d8e090bc7b43c2fa3`.
- Repeated semantic comparator: candidate `72c7150` selects `interactive-process` `3/3`; pre-policy baseline `9d051ea` selects it `0/3`. Candidate strict success is `3/3`; baseline strict success is `2/3` because r3 classified the benchmark message as non-material. That baseline failure is preserved, not trimmed.
- Raw comparator aggregate SHA-256 `b15aa7eb6d0ffbfd14951c4190c8d6b6cb69c1d0274aa79e5b2c23775a43f287` intentionally remains `success:false` because it required all six rows to be strict successes.
- Mechanical cutover receipt SHA-256 `42432a093874d75e97c4ae24cac1ca27e590f47c88bfdb635d3301bbf1fb5f23` records `mechanical_retain=true` without rewriting the raw aggregate.

Decision: **RETAIN_INTERACTIVE_PROCESS_CAPABILITY_GATE** for correctness/predictability, not a general latency/token/cost superiority claim.

## MCP evidence

Exact OpenCode `1.18.18` source/runtime and current official OpenCode documentation agree that MCP tools are controlled through native permission rules and server-name wildcards. The retained Hi policy adds only task selection/supervision.

`M12_MCP_NATIVE_EXPOSURE_REALHOST_AGGREGATE`:

- local MCP connected `3/3`;
- unselected configured server received native `server_* = false` exposure `3/3`;
- selected server was not Hi-denied `3/3`;
- candidate emitted no permission `true` widening;
- aggregate SHA-256 `5fb4d956a186a41ac2306966d0adabb7d5d5d7c250e2f9afd6375a784b2532a9`.

Decision: **RETAIN server-scoped MCP exposure**. No custom MCP proxy or generic tool engine was retained.

## Browser evidence

M12 did not widen browser scope. The existing browser implementation remains a bounded local Playwright executor owned by active visual/browser methodology workers, with task/execution-owner isolation, bounded observations, artifact-backed screenshots, default-off child tool exposure and fail-closed runtime availability.

The retained browser real-host ablation from M10 v12 is `3/3` strict on both arms; aggregate SHA-256 `d021e26dbdd650a0dbd373faf751619ee9a88f0d811ee2d05f5eb125f7ffced2`. Current M12 browser contract/regression tests remain green. Browser autopilot/backend evolution is intentionally left to M13.

## Final verification

Exact Git archive of `72c71504be3b71e82cd45837c0c1db13af68aa7f`:

- build PASS; log SHA-256 `f1d963ec4ae1a5f8d0bf0beabd20fdf4a2fd4f2093fb391f51461d41b5363e80`;
- architecture lint PASS; log SHA-256 `179c0c2342de88218e68c8cdff8978d1d633faa88b2cd9bc99c1f476e3d8f973`;
- plugin suite `990/990 PASS`; log SHA-256 `651de97a88f1c5d21eab92bf9bfb49206c2aa0c4c073bd29da62fdbb5172a0a1`;
- built `plugin/dist/plugin.js` SHA-256 `66980d0546f69c9b32a045291fa9601289dcc31422ab8a6c493b94c702689bea`.

Unrelated dirty validation/release/script/routing/test files were preserved. No push/tag/release/npm publish was performed.
