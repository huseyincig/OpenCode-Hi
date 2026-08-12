# Context Architecture

Hi separates Mission Survival State, Context Governor, Project Intelligence, Semantic Context, Privacy Boundary, and optional Memory Broker.

Mission survival data is protected from context pressure. The governor classifies non-survival context as `PROTECTED`, `COMPRESSIBLE`, or `PURGEABLE` and may return `NOOP` for small contexts. Duplicate/superseded payloads are purgeable; resolved exploration and old reconciled detail are compressible.

Artifact-first handling stores long durable outputs with concise summaries, hashes, retrieval handles, and freshness/provenance rather than repeatedly injecting raw payloads.
