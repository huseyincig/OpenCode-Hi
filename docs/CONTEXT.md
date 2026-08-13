# Context Architecture

Hi separates Mission Survival State, Context Governor, Project Intelligence, Semantic Context, Privacy Boundary, and optional Memory Broker.

Mission survival data is protected from context pressure. The native OpenCode compaction bridge is the production consumer of Context Governor policy: survival-critical entries are `PROTECTED`, bounded task/evidence/artifact detail is `COMPRESSIBLE`, and disposable reminders are `PURGEABLE`. Small contexts may remain `NOOP`.

Task context is minimum-sufficient by construction. Mission context artifacts are not broadcast to every child: the default selected artifact count is zero, and a task receives only explicit `context_artifact_ids`. Unknown ids fail closed. Long retained content is stored by `ContextArtifactStore` under the Context owner, referenced by summary/hash/handle, and loaded only while source-bound freshness is `FRESH`; stale retained content is not reinjected.

Semantic Context is operational for bounded task-scoped TypeScript/TSX targets and extracts contract surfaces without injecting full dependency trees. Project Intelligence is retrieved only by structured task-scope file intersection and only when `ACTIVE` and `FRESH`; it remains context, never verification or proof. Source mutation invalidates both matching Project Intelligence patterns and source-bound durable context artifacts.

Provider-facing handoffs, including selected artifact content, pass through the Privacy Boundary. Optional Memory may assist retrieval but never owns MissionState or satisfies verification.
