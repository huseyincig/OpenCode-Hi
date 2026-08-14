# Context Architecture

Hi separates Mission Survival State, Context Governor, Project Intelligence, Semantic Context, Privacy Boundary, and optional Memory Broker.

Mission survival data is protected from context pressure. The native OpenCode compaction bridge is the production consumer of Context Governor policy: survival-critical entries are `PROTECTED`, bounded task/evidence/artifact detail is `COMPRESSIBLE`, and disposable reminders are `PURGEABLE`. Small contexts may remain `NOOP`.

Task context is minimum-sufficient by construction. Mission context artifacts are not broadcast to every child: the default selected artifact count is zero, and a task receives only explicit `context_artifact_ids`. Unknown ids fail closed. Long retained content is stored by `ContextArtifactStore` under the Context owner, referenced by summary/hash/handle, and loaded only while source-bound freshness is `FRESH`; stale retained content is not reinjected.

Semantic Context is operational through the explicit `SemanticContextAdapter` port. The only current adapter is `TypeScriptSemanticContextAdapter`, advertising language ids `typescript` and `typescriptreact` and supporting only `.ts`/`.tsx` files; it extracts bounded contract surfaces without injecting full dependency trees. JavaScript, LSP-backed and Tree-sitter-backed semantic adapters are not implemented or advertised. Project Intelligence retrieval is derived locally from the existing PI store using lexical relevance, path proximity, shared source-ref graph signals, and deterministic reciprocal-rank fusion; only `ACTIVE`, `FRESH`, consumer-eligible records can enter task context, and confidence ranks eligible context but never proves correctness. It remains context, never verification or proof. Source mutation invalidates both matching Project Intelligence patterns and source-bound durable context artifacts.

Provider-facing handoffs, including selected artifact content, pass through the Privacy Boundary. Optional Memory may assist retrieval but never owns MissionState or satisfies verification.
