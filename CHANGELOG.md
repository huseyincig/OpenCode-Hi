# Changelog

All notable changes to OpenCode-Hi are documented here.

## Unreleased

## 0.2.3

- Bounds verification/completion recovery when a required runtime capability is unavailable: mandatory visual/browser, MCP, model-dispatch, workspace, process, dependency and session-abort failures now resolve to durable terminal operational state instead of feeding unchanged synthetic continuations.
- Routes `visual-check` through the canonical visual methodology/browser preflight, keeps verification evidence-owned, and makes `hi_direct_progress` return `EVIDENCE_REQUIRED` for verification obligations instead of allowing prose to close them.
- Adds one-shot Chromium self-healing for the Hi-owned Playwright surface using pinned `playwright-core@1.62.1`, a Hi-owned platform cache, bounded bootstrap time, and failure deduplication; unavailable bootstrap remains an explicit environment/capability blocker rather than a retry loop.
- Makes child-result parent wake re-enter the canonical completion/continuation evaluator and hardens failed process lifecycle/abort paths so unverified native ownership cannot masquerade as healthy `WAIT`.
- Adds a Node-native project-control UX for the `0.2.3` candidate: `install` now safely ensures setup/update ownership; terminal `setup`/`install` runs a bounded canonical-policy wizard; `reconfigure` reopens it; and `state`, `reprofile`, `roles`, `rotate`, and `check-update` expose bounded common configuration without hidden postinstall mutation or provider credential ownership. CI/non-TTY setup remains deterministic via automatic detection or `--non-interactive`.
- Adds `npm run release:preflight -- --sha <exact-HEAD>` as a fail-closed, read-only candidate check for clean SHA/version/tag/npm/pack identity; it never tags, pushes, creates a GitHub Release, or publishes.

## 0.2.2

- Makes npm the normal-user bootstrap path with a Node-only `opencode-hi` package runner (`setup`, `update`, `doctor`, plus bounded recovery commands), while preserving the existing transactional ownership/provenance model and the legacy Python setup surface for compatibility.
- Moves initial child-model routing to OpenCode's effective runtime provider inventory: Hi no longer fabricates an offline provider catalog, no longer depends on the unsupported OpenCode 1.18.19 `models --json` shape, and no longer truncates configured or reported model lists at eight entries.
- Preserves host-reported image-input capability and makes it a hard prerequisite for `visual-qa`; a visual task will not silently fall through to a text-only or unverified host-default model.
- Removes hard-coded child-role model recommendations. On first effective inventory, Hi now ranks the models the user actually enabled with the canonical role/category cost-quality scorer, persists one-shot initial child-role preferences, preserves later user edits across refresh/update, and keeps `manager` / `working-manager` model ownership OpenCode-native.
- Retargets the package SDK/plugin compatibility identity to exact OpenCode 1.18.19. Linux/aarch64 pre-publication packed-artifact acceptance is verified locally; Windows Desktop 1.18.19 and fresh-registry 0.2.2 acceptance remain release gates and are not claimed by this source state.
- Makes OpenCode 1.18.19 workspace-isolation health/preflight respect the host's `OPENCODE_EXPERIMENTAL_WORKSPACES` gate, avoiding false-positive capability health and failing closed before the host can materialize an unowned worktree when workspace support is disabled.

## 0.2.1

- Simplifies model ownership: OpenCode owns the primary `manager` / `working-manager` session model, while Hi role-model routing accepts only the six child roles. Auto-init, project config resolution and setup CLI now enforce the same boundary.
- Adds complete English and Turkish Windows/Linux/macOS installation and configuration guides, including primary-vs-child model ownership, single-model/per-role/fallback/variant/category/provider/concurrency recipes and generated canonical option references.
- Makes current-source native direct-Git installation a first-class package contract: removes root npm/Pacote Git-preparation trigger script names, keeps the OpenCode host peer optional, shrinks the clean install graph, and adds exact-SHA Git materialization plus exact OpenCode 1.18.18 host-load acceptance to cross-platform Release Readiness. Immutable `v0.2.0` remains historical and is not retagged.

## 0.2.0

- Introduces the Phase 2 Semantic Autopilot runtime: work-graph-first execution, semantic intent assessment, adaptive execution planning, stronger completion/continuation ownership, and bounded model/provider feedback.
- Adds canonical diagnosis-only mission semantics, field-scoped semantic parser diagnostics, and stricter WorkerResult settlement compatibility while keeping narrative evidence fail-closed.
- Hardens dependency/fan-in scheduling, queue rollback, workspace/process/browser supervision, MCP capability scoping, authority boundaries, and model/runtime recovery with deterministic settlement evidence.
- Prevents short-lived POSIX PTY output loss by holding the requested command behind an attach-ready cursor/marker barrier until OpenCode WebSocket replay is established; restart replay keeps the internal marker outside user-visible output.
- Retains exact OpenCode 1.18.18 npm/local-package acceptance; direct Git-source plugin installation remains an explicit unsupported host boundary until exact-host proof exists.
- M15 broad corpus closes with task-class-specific evidence only; this release does not claim general Hi superiority over vanilla OpenCode.

## 0.1.3

- Corrected the npm Trusted Publishing workflow so canonical evidence verification installs its Python verification dependencies before running the full release gate.
- Preserves the documentation-correctness and complete packed public-document surface prepared in 0.1.2; no intentional runtime behavior change.
- `v0.1.2` remains immutable as a GitHub release whose npm publication did not occur because the publish workflow failed before the publish step.

## 0.1.2

- Corrected public documentation freshness across the English and Turkish README surfaces.
- Package all canonical public documentation referenced by the npm README so relative links remain valid in the published tarball.
- Added fail-closed packed-document parity, stale-reference, and local-link validation for npm releases.
- No runtime behavior change; this is a documentation/governance patch release.

## 0.1.1

- Completed the full zero-defect hardening and certification program across authority, persistence, concurrency, host portability, security, test quality, mutation/property/replay/failure-injection, performance, user/developer journeys, cross-platform claim boundaries, and exact-current OpenCode T3.
- Revalidated Hi-owned process lifecycle, workspace isolation binding, and browser execution against exact OpenCode 1.18.18 on Linux/aarch64.
- Preserved historical `v0.1.0` release identity; `0.1.1` is the new release identity for the hardened current source.
- Published `v0.1.1` to GitHub and `opencode-hi@0.1.1` to npm through Trusted Publishing OIDC; T4 receipts verify exact tag/source binding, registry integrity/provenance and fresh-registry OpenCode acceptance.

## 0.1.0

- Introduced OpenCode-Hi as an evidence-aware adaptive execution and Hybrid Intelligence control plane for OpenCode.
- Added deterministic Mission, Obligation, Task, Worker, Evidence, Authority, Completion, Continuation, and STOP semantics.
- Added adaptive execution across role, skill, model/tool, execution depth, context depth, and isolation depth.
- Added bounded single-agent/multi-agent topology decisions with native OpenCode execution.
- Added 27 canonical `hi-*` methodology skills with default-zero activation and lazy resource loading.
- Added Context Governor, Project Intelligence, TypeScript Semantic Context, provider privacy boundary, artifact-first results, optional memory boundary, truthful host capability contracts for process/workspace/browser limitations, and human-decision routing.
- Added canonical `executionPolicy` (`minimal`, `balanced`, `thorough`, `adaptive`, `manual`) and adaptive model routing.
- Added deterministic release artifacts, manifest, SBOM, source validation, lifecycle validation, benchmarks, and architecture/terminology audits.
- OpenCode-Hi 0.1.0 exposes no former-product configuration, CLI, runtime, telemetry, schema, package, or skill compatibility aliases.
