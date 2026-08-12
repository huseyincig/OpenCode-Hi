# Privacy Boundary

Local knowledge is not automatically provider knowledge. Provider-facing task prompts pass through bounded local redaction before model dispatch. Synthetic secret patterns are covered by tests; plaintext secret values are not intentionally persisted to mission state, telemetry, logs, or durable artifacts.

Redaction mappings are request/lifecycle scoped and are not written to the ledger. Privacy filtering complements, rather than replaces, OpenCode host permissions.
