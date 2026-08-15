# Third-Party Notices

OpenCode-Hi is an Apache-2.0 project. Third-party orchestration control planes are not vendored into the product. Source-level references are integrated only under the decisions recorded in `docs/SOURCE-REUSE-MATRIX.md`.

## Direct build/runtime dependencies

| Package | Relationship | License | Use |
|---|---|---|---|
| `@opencode-ai/plugin` `1.18.18` | host peer dependency | MIT | OpenCode native plugin API, types, and runtime contract |
| `@opencode-ai/sdk` `1.18.18` | direct runtime dependency | MIT | Exact OpenCode v2 client used by native session/PTY/workspace adapters |
| `playwright-core` `1.62.1` | optional runtime dependency | Apache-2.0 | Browser execution adapter; runtime health remains explicit and no browser binary is bundled |
| `typescript` | development dependency in the runtime workspace | Apache-2.0 | TypeScript compiler/build toolchain |

The root `package-lock.json` owns the publishable distribution dependency graph; `plugin/package-lock.json` separately owns the runtime-workspace build/test dependency graph. Both are lockfile-v3 integrity-bound. The only dependency entry declaring an install script in either current lock is optional MIT-licensed `msgpackr-extract@3.0.4` (optional native acceleration under `msgpackr`); release CI installs both lock graphs with `--ignore-scripts`, so dependency lifecycle scripts do not execute during candidate verification or publication. Registry consumers remain governed by npm's normal dependency-install behavior.

## Source-level reference projects

The 0.1.x implementation studied the user-supplied source archives listed in the Source Reuse Matrix. Permissively licensed primitives may be adapted when ownership boundaries remain under Hi control. AGPL, missing-license, unclear-license, or otherwise incompatible material is restricted to clean-room behavioral study, idea-only use, or rejection as recorded in that matrix.

Historical baseline source identifiers and third-party names may remain only in provenance records, immutable validation receipts, source-attribution/license records, or negative rejection tests where technically required. They are not the canonical OpenCode-Hi product identity.
