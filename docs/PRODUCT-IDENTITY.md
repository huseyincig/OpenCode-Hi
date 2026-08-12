# OpenCode-Hi Product Identity

OpenCode-Hi 0.1.0 is a new product identity with its own public and internal contracts.

The implementation is source-derived from the verified OpenCode-HHC-Orchestrator v58 baseline for engineering continuity and regression provenance. That ancestry does **not** create a product-compatibility obligation.

## Canonical rule

- Source ancestry: preserved as forensic provenance.
- Legacy product compatibility: not supported.
- Legacy runtime aliases: not supported.
- Legacy configuration aliases: not supported.
- Legacy CLI aliases: not supported.
- Legacy telemetry/schema aliases: not supported.
- Legacy package/plugin fallback identifiers: not supported.
- Legacy skill namespace: not supported.

Historical HHC/OHO identifiers may remain only where technically necessary for exact baseline provenance, source attribution, license obligations, or immutable historical receipts. They must not be accepted as active OpenCode-Hi inputs or presented as current product identity.

## Canonical OpenCode-Hi terminology

- Product: `OpenCode-Hi`
- Package: `opencode-hi`
- Skill namespace: `hi-*`
- Execution policy: `minimal | balanced | thorough | adaptive | manual`
- Model policy: `recommended | adaptive | manual`
- Adaptive role set: `adaptiveRoles`
- CLI execution option: `--execution-policy`

OpenCode-Hi does not parse or normalize former product configuration names. Unknown legacy fields are treated exactly like other unknown unsupported fields and do not alter canonical state.
