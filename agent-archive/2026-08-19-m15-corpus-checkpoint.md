# M15 Corpus Checkpoint — Production + Final Integration

**Date:** 2026-08-19
**Status:** M15 ACTIVE
**Final product identity:** `e0f7d9118bfe729e35520ec01c5ac8ac41e424c8`

## Completed broad corpus cell

Localized OpenCode production regression triad is complete under the same fixture/model/variant/deterministic acceptance contract:

- vanilla OpenCode: `3/3 VERIFIED_SUCCESS`;
- retained Phase 1 Hi `8f6b19098b1db0a739bb97f82537fcdc45896278`: `3/3 VERIFIED_SUCCESS`;
- final Phase 2 Hi `e0f7d91`: `3/3 VERIFIED_SUCCESS`.

Aggregate: `/workspace/Reference/phase2-autopilot/m15-localized-production-triad-aggregate.json`
SHA-256: `b9c6410ce028d043def55df478d215e272297af44540ed5a6657db71719b4f6d`.

All three systems satisfy correctness on this cell. The aggregate deliberately makes no broad superiority claim. Historical M8 runtime used the then-present `/usr/local/bin/opencode`; new final Phase 2 uses the preserved pinned `1.18.18` binary, so economics are descriptive rather than treated as exact binary-identical comparison. OpenCode-derived monetary values are not provider-billed cost.

## Final-product component / real-host integration

- retained Phase1 ↔ final Phase2 deterministic component replay: context-heavy, authority, provider recovery, restart stale and coexistence all PASS with equal acceptance — aggregate SHA-256 `4aa00988e3ea7e90d2da2d492c82812fb773bbdb2ddc938cbe83e96d4421196d`;
- final workspace reintegration `3/3 PASS` — `3ae4de372070dd43eb42b26eec8f4e2b1c95392a3c5086279308ae704c495b1e`;
- final browser backend integration `3/3 PASS` — `dc19782f834ac7a23488a40ec3d52969af17f8b8398c6994426cbaf5d26106f4`;
- final MCP server-scope integration v2 `3/3 PASS` — `d715ed319942673c51bab6e6a885894b6050483fd37203371fc47ef92de18a7a`.

The prior MCP immediate-read v1 failure is retained. Exact OpenCode 1.18.18 source converts prompt `tools` booleans to session permission rules; the v1 harness read the session immediately after `prompt_async` and observed nondeterministic persistence visibility. v2 changes only the Reference harness to bounded read-after-write reconciliation. Product code was not changed.

Coverage matrix v3: `/workspace/Reference/phase2-autopilot/m15-corpus-coverage-v3.json`, SHA-256 `365859214da6fa3d84ab33b2610a5a518b1e6d7c67f8270b6228f5705c433fdd`.

## Active batch

Combined diagnosis/root-cause + context-heavy real-repository batch is running as SentinelX job `job_d87a7a0d27b9`. It runs three repetitions per system for vanilla, retained Phase1 and final Phase2 with pinned OpenCode `1.18.18`, DeepSeek V4 Flash low and deterministic structured diagnosis acceptance. Do not launch a duplicate.

After that result is aggregated, decide whether the remaining multi-module/decomposition/fan-in broad gap earns the model cost of the prepared replay.
