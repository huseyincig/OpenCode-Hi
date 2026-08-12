# Security

OpenCode-Hi does not persist provider API keys or credentials as product state. Remote Git operations use the host environment's existing Git/SSH/credential-manager configuration; Hi does not collect interactive credentials.

- Push, tag, publish, deploy, and release operations remain explicit authority gates.
- Agent permissions are role-scoped; reviewer roles remain read-only.
- MCP is not installed or enabled by default.
- Existing project files are not overwritten through setup flows unless the operation explicitly permits replacement.
- Skill access is generated from exact role allowlists. Skill bodies and large resources are loaded only when activation requires them.
- Provider-facing context passes through the Privacy Boundary before model invocation. Plaintext secrets must not be persisted to logs, telemetry, mission state, provider transcripts, or durable artifacts.
- Archive extraction and update/install helpers must reject path traversal and unsafe symlink entries.
- Host permission denial is authoritative: Hi may restrict host authority but must never expand or bypass it.

## Reporting a vulnerability

Do not include credentials, plaintext secrets, or private repository content in a public report. Provide the smallest reproduction that demonstrates the affected trust boundary and identify whether the issue involves provider context, local runtime state, workspace isolation, process lifecycle, package integrity, or host authority.

## External methodology and skill sources

Source repositories may be studied or assimilated only under the license and provenance rules in `docs/SOURCE-REUSE-MATRIX.md`. Downloaded skill resources are data until explicitly invoked under the active role's normal permissions; setup must not execute arbitrary helper scripts from an external skill source.
