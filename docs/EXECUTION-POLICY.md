# Adaptive Execution Policy

Hi evaluates six independent axes: role, skill, model/tool, execution depth, context depth, and isolation depth. Complexity never automatically means strongest model, more agents, broader context, or more skills.

Execution paths are `DIRECT`, `EVIDENCE`, `PLANNED`, and `ESCALATED`. DIRECT is the default for clear local reversible work. EVIDENCE retrieves only information that can change the next decision. PLANNED is used for genuine dependency/sequencing work. ESCALATED records a material reason before increasing model strength, specialists, context, review, verification, or isolation.

Topology policy defaults to one agent. Bounded fan-out occurs only for materially independent streams or distinct review domains. Project overrides are resolved before adaptive selection; explicit task model selection remains the highest model override.
