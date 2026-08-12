# Third-Party Notices

OpenCode-Hi is an Apache-2.0 project. Third-party orchestration control planes are not vendored into the product. Source-level references are integrated only under the decisions recorded in `docs/SOURCE-REUSE-MATRIX.md`.

## Direct build/runtime dependencies

| Package | Relationship | License | Use |
|---|---|---|---|
| `@opencode-ai/plugin` | host peer dependency | MIT | OpenCode native plugin API, types, and runtime contract |
| `typescript` | development dependency | Apache-2.0 | TypeScript compiler/build toolchain |

Transitive dependencies and their detected license metadata are captured in the generated SBOM from the exact lockfile used for the candidate.

## Source-level reference projects

The 0.1.x implementation studied the user-supplied source archives listed in the Source Reuse Matrix. Permissively licensed primitives may be adapted when ownership boundaries remain under Hi control. AGPL, missing-license, unclear-license, or otherwise incompatible material is restricted to clean-room behavioral study, idea-only use, or rejection as recorded in that matrix.

Historical baseline source identifiers and third-party names may remain only in provenance records, immutable validation receipts, source-attribution/license records, or negative rejection tests where technically required. They are not the canonical OpenCode-Hi product identity.
