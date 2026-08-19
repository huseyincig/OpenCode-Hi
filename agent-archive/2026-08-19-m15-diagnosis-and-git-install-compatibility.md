# M15 Diagnosis Semantics + Git Install Compatibility Checkpoint

Date: 2026-08-19
Status: M15 ACTIVE; diagnosis cutover verified and final fan-in corpus batch active.

## Retained product cutovers

- `0b48d110a668c3646ee7dfbdff581cd17271d1d7` — canonical diagnosis-only mission semantics: structured `diagnosis` task kind, read-only/analysis-only obligations, no implementation mutation or normal passing-test completion obligation, canonical diagnostic evidence and bounded routing semantics.
- `18c9d4501598930d2ec50af224a52b29ee6fe6f9` — field-scoped closed-enum parser diagnostics. This changes error provenance only; accepted enum sets remain fail-closed and valid diagnosis parsing is unchanged.

Exact immutable `18c9d45` verification: build PASS; architecture lint 22/22 PASS; focused diagnosis/parser contract PASS; plugin suite 1029/1029 PASS.

## Diagnosis corpus finding

The real OpenCode ripgrep diagnosis-only task keeps production/tests unchanged, writes only deterministic `diagnosis.json`, identifies `packages/core/src/ripgrep.ts` and `match.lines.text.slice(0, 2_000)`, explains UTF-16 surrogate splitting, cites test+source evidence, and leaves the regression unfixed.

Pre-cutover Hi produced correct external diagnosis but could not settle because `bug-fix` semantics forced implementation/verification obligations. `0b48d11` added diagnosis semantics; its remaining r2 failure came from a model-supplied invalid `required_capabilities:[...,"diagnosis"]`. The parser's generic `unsupported semantic enum value(s): diagnosis` caused the model to wrongly abandon valid `task_kind=diagnosis`. `18c9d45` makes that error field-specific while preserving rejection. The `18c9d45` final real-host rerun completed `3/3 VERIFIED_SUCCESS`, external acceptance `3/3 PASS`, strict Hi settlement `3/3 PASS`. Aggregate: `/workspace/Reference/phase2-autopilot/m15-diagnosis-context-18c9d45-aggregate.json`, SHA-256 `090b584c30d89481affc06f2d06f72056802e94822e82718b01b5ea59a67a5f3`. Coverage v4 leaves only the multi-module/decomposition/fan-in broad gap; final fan-in job `job_02f741bb3d2c` is active and must not be duplicated.

## Git-source installation compatibility

Desired future config form:

```json
{
  "plugin": [
    "opencode-hi@git+https://github.com/huseyincig/OpenCode-Hi.git"
  ]
}
```

The repository/package is a valid Git dependency: isolated npm and Bun installs both PASS and include the packaged plugin entrypoint. Exact OpenCode 1.18.18 does not currently provide accepted end-to-end native Git-plugin installation/loading for this spec: direct config resolves the public GitHub source but exposes no Hi tools; `opencode plugin <spec>` fails `git dep preparation failed`. Removing root `prepack` in a local Git probe does not change the failure, so the evidence does not support blaming the OpenCode-Hi package lifecycle. Keep this as a host compatibility boundary, not a package failure or a claim about newer OpenCode versions.

Compatibility receipt: `/workspace/Reference/git-plugin-compatibility-opencode-1.18.18.json`, SHA-256 `32d9a98ebc4dbfee00f4a55b717aa513111b4b00da1b08f4dcb63921f080bbd5`.

No push/tag/release/npm publication was performed.
