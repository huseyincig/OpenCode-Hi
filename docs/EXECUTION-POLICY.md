# Adaptive Execution Policy

Hi evaluates six independent axes: role, skill, model/tool, execution depth, context depth, and isolation depth. Complexity never automatically means strongest model, more agents, broader context, or more skills. Fixed presets use fixed role/review profiles; adaptive mode selects a profile from structured mission state; manual mode uses the balanced role baseline.

Execution paths are `DIRECT`, `EVIDENCE`, `PLANNED`, and `ESCALATED`. DIRECT is the default for clear local reversible work. EVIDENCE retrieves only information that can change the next decision. PLANNED is used for genuine dependency/sequencing work. ESCALATED records a material reason before increasing model strength, specialists, context, review, verification, or isolation.

Topology policy defaults to one agent. Bounded fan-out occurs only for materially independent streams or distinct review domains. Model-selection precedence is explicit task model > durable project Hi policy > raw/native Hi-compatible input > adaptive scoring > host default. Selection preferences may be overridden by project policy, but provider/model safety constraints compose monotonically: deny lists are additive and multiple allowlists intersect, so a project override can narrow a higher-level constraint but cannot weaken it.
