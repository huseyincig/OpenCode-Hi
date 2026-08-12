## 2.0.10 v57 checkpoint — external blocker hardening

- Re-audited the five remaining forensic items after v56; no new internal defect was found.
- Added `data/validation/external-blockers-v57.json` with exact fresh-evidence prerequisites for #32, #44, #46, #51 and #60.
- Retried fresh clean-room `npm ci`; dependency installation remains environment-blocked by container DNS/registry access. The observed `ini@7` engine warning is transitive through the OpenCode peer dependency chain (`effect -> ini`), not a direct HHC dependency.
- Forensic progress remains truthful at 56/61 COMPLETE, 5/61 PARTIAL_EXTERNAL, 0 FAIL, 0 unresolved internal findings.

# Changelog

## 2.0.10 v56 checkpoint — real OpenCode model routing + live Team Mode

- Real OpenCode CLI 1.18.16 routing E2E now proves parent `openai/hhc-parent` → `hhc_task_start` → native coder child session → provider request `openai/hhc-coder` → assistant-message runtime metadata → `effective_model_verified=true`.
- Real live Team Mode E2E proves `hhc_team_create` creates architect and repository-explorer native child sessions using `openai/hhc-architect` and `openai/hhc-explorer`; both run as OpenCode subagents and the bounded team shuts down with `members-terminal`.
- Project-owned private HHC runtime settings are read from `.opencode/oho-routing.json`; reconfigure no longer mutates native `opencode.json/jsonc` with private HHC keys.
- Native provider inventory refresh no longer blocks `chat.message` when host inventory is unresolved.
- Native child chat messages cannot accidentally create nested top-level HHC missions.


## 2.0.10
- v55 forensic checkpoint: fixed release tag-push accounting so `git push origin v2.0.10` is treated as an explicit tag push instead of `refs/heads/v2.0.10`, preserves the current branch push proof, and requires the tag push to be remotely verified against the expected commit (peeled SHA for annotated tags) before release creation. Added a real bare-Git + local HTTP hosted-release transaction acceptance covering branch push, annotated tag push, release create, release view, asset metadata, and exact remote tag verification. Forensic items #34 and #35 are now COMPLETE_LOCAL; public credential/OAuth authority remains external under #32.

- v54 forensic checkpoint: added a real npm-registry protocol acceptance around production HHC release-chain and authority logic. The test performs a fresh `npm pack --dry-run --json`, an actual `npm publish` HTTP PUT side effect to an isolated local registry, then a real `npm view opencode-hhc-orchestrator@2.0.10 --json`; HHC keeps publish remote-unverified until exact version, `dist.integrity`, and `dist.shasum` match the pack proof. Forensic item #36 is now COMPLETE_LOCAL; public npm account/OAuth authority remains external under item #32.

- v52 forensic checkpoint: added exact immutable Git-ref clean-consumer install/Doctor/uninstall regression coverage; foreign plugin, MCP and user-owned config remain preserved. Exact Git host-loader execution remains external-pending rather than inferred from static Doctor success.

### v51 external checkpoint
- Real OpenCode CLI 1.18.16 same-session follow-up verified: `testleri de yap` amends the existing mission verification obligation without creating a new mission or generation.
- Real OpenCode CLI 1.18.16 STOP verified: mission transitions to stopped/user-interrupted and subsequent native message/status/idle events are ignored by the HHC runtime.
- Clean-consumer lifecycle re-run: install → Doctor OK → user config drift → Doctor WARN → uninstall, preserving foreign plugin/MCP/user fields. Exact Git host-loader binding remains externally pending in the offline harness.


- v50 forensic progress checkpoint: fixed stale Python release-gate semantics after checkpoint-level external CLI PASS, added a machine-readable 61-section audit progress matrix (48 COMPLETE_LOCAL / 13 PARTIAL_EXTERNAL), and removed stale `oho_only_smoke` from the external-only pending list without promoting exact-release gates.

- OpenCode CLI 1.18.16 post-fix external E2E checkpoint (v49):
  - normalized the single outer JSON-style quote layer emitted by `opencode run` before intent/casual classification, so CLI greetings remain non-material while engineering requests preserve their real objective text;
  - hardened native housekeeping detection for OpenCode 1.18.x `experimental.chat.system.transform`, where title generation omits `input.agent`; HHC now recognizes the host-provided title/summary/compaction system prompt before appending control-plane context;
  - real clean-consumer CLI + localhost OpenAI-compatible provider smoke now proves casual request => 0 HHC mission / no HHC contract injection, material engineering request => 1 correctly-scoped mission / HHC contract present only on the Working Manager call;
  - external CLI requests exposed the expected 15 default HHC tools with Team tools absent by default; fresh project persistence remained project-local and initialized with `uncleanShutdown=false`.
  - current checkpoint validation: **351** Node tests + **36** Python tests + VALIDATION PASS.

- OpenCode CLI 1.18.16 external-runtime hardening checkpoint:
  - fixed non-git native context where OpenCode reports `worktree=/`; filesystem-root sentinel can no longer override the actual project `directory` or leak persistence into `/.opencode`;
  - fixed packaged HHC skill provenance wiring so worker-side methodology resolution receives the HHC package root rather than the consumer project root;
  - aligned `chat.message` with the real OpenCode 1.18.x hook shape (`output.message` + `output.parts`) while keeping legacy fixture compatibility;
  - pure greeting/small-talk messages no longer create empty HHC missions;
  - native `title`, `summary`, and `compaction` housekeeping agents are excluded from HHC control-plane message/system injection to preserve context economy;
  - added native-shape regression coverage for mission start, verification follow-up, STOP, housekeeping filtering, and normal Working Manager injection.

- Final zero-defect forensic audit hardening:
  - source/release packaging now rejects nested `.opencode` runtime-state contamination and Node acceptance no longer writes project runtime state into the source tree;
  - removed the last executable legacy Superpowers config compatibility branch;
  - enabled TypeScript `noUnusedLocals`/`noUnusedParameters` and removed dead imports/parameters;
  - aligned plugin workspace license metadata with the repository Apache-2.0 license and added release-identity enforcement;
  - living validation receipts no longer hardcode test counts that become stale after regression additions.

- HHC-native methodology consolidation:
  - removed the Official Superpowers runtime/plugin integration and all second-plugin discovery/load-order/takeover surfaces;
  - adopted 10 bounded methodology concepts as HHC-native skills: source-driven development, TDD, review feedback, architecture decisions, iterative retrieval, design discovery, API/interface design, workspace isolation, skill authoring, and adversarial validation;
  - HHC now ships **29 native skills** total with skill default zero, normal target 0-1, maximum 3, and child-specific loading;
  - third-party methodology sources remain attribution/research provenance only and are not runtime dependencies.
- Role/native-skill permission synchronization after consolidation: all 8 role manifests, generated agent config, router preflight, and packaged dist now use the same 29-skill HHC-native matrix; legacy Superpowers skill permission names were removed from living runtime/validation contracts.
- Validation after native-skill consolidation and permission synchronization: **340** Node tests + **33** Python tests + VALIDATION PASS.

- Release-quality batch hardening from the master transformation audit:
  - release creation now verifies tag version against VERSION, root package.json, plugin/package.json, and the current CHANGELOG entry before remote mutation;
  - supplied distributable assets are SHA-256 checked against the generated RELEASE-MANIFEST;
  - release-build.py enforces the same identity contract before producing release artifacts and records release identity in manifest schema 3.
- Test count after release-quality hardening: **275** Node tests + **23** Python tests.

- Scheduler / parallel-runtime hardening from the master transformation audit:
  - worker spawn dedup fingerprints now include scope, constraints, dependencies, evidence requirements, and obligation ownership so distinct task contracts cannot collapse into one worker;
  - direct dependencies serialize through the queue instead of being rejected as unsafe parallel work, while shared completed prerequisites no longer serialize independent siblings;
  - normalized parent/child path surfaces (for example `src/auth` vs `src/auth/token.ts`) are treated as overlapping write surfaces;
  - unknown or terminally failed dependencies are rejected/blocked deterministically instead of waiting forever;
  - queued dependents are removed and marked dependency-blocked when a prerequisite later fails or is cancelled;
  - model/provider slot rebinding now re-checks target capacity, preventing fallback/escalation from oversubscribing a saturated model.
- Test count after scheduler hardening: **188** Node tests + **17** Python tests.

- Runtime hardening pass from the master transformation audit:
  - workers now bind to both `parent_mission_id` and generation so late child callbacks from a previous mission cannot affect a new mission in the same OpenCode session;
  - stale-child rejection now runs before permission-event accounting;
  - stagnation recovery keeps alternate-plan and bounded-fresh-worker as separate rungs;
  - level-2 reasoning recovery can deterministically resume the same child session with a stronger-category model when policy/capacity allow it.
- Test count after hardening: **173** Node tests + **17** Python tests.

- Patch release. Updates the auto-init default per-role model map.
- `DEFAULT_ROLE_MODELS_OPENCODE_GO` in `plugin/src/config/auto-init.ts`
  now uses:
  - coder: `opencode-go/deepseek-v4-pro`
  - security-reviewer: `opencode-go/glm-5.2`
  - qa-reviewer: `opencode-go/qwen3.7-plus`
  - architect: `opencode-go/glm-5.2`
  - visual-qa: `opencode-go/mimo-v2.5`
  - repository-explorer: `opencode-go/deepseek-v4-flash`
- When `.opencode/oho-routing.json` is missing in the project root
  on plugin startup, OHO writes this default; existing user-owned
  files are not overwritten.
- 3 new tests in `plugin/test/routing-defaults.test.mjs` lock the
  default map, the file-write path, and the idempotent second-call
  behavior.
- Test count: **163** (160 from 2.0.9 + 3 new).

## 2.0.9

- Patch release. Closes Phase 7 runtime evidence gaps.
- 7 new tests in `plugin/test/phase7-runtime-evidence.test.mjs`:
  - Gap #28: persistence round-trip preserves mission state.
  - Gap #29: stagnation recovery ladder rungs distinguish same-worker
    vs new-worker.
  - Gap #30: progress signature updates only on semantic state
    changes.
  - Gap #31: pending child worker blocks mission completion.
  - Gap #32: user-owned config sections survive schema migration.
  - Gap #33: project context reads worktree when available.
  - Gap #34: update semantics preserves user-owned config across
    schema bumps.
- Test count: **160** (153 from 2.0.8 + 7 new).
- No behavior change; all invariants are already implemented in the
  source code.

## 2.0.8

- Patch release. Closes Gap #24 + extends Section 88-96 acceptance
  evidence.
- `capability-router.ts` now accepts a `ProfileSettingsLite` argument
  with `specialistThreshold` and `reviewThreshold`. The basic,
  standard, and powerful profiles gate specialist dispatch:
  - basic (high threshold) falls through to `coder` for non-explicit
    signals; dispatches `qa-reviewer` only when risk is high or
    capability explicitly includes `qa-review`/`security-review`.
  - standard (medium) routes repo-wide scope and explicit
    architecture keywords to `architect`.
  - powerful (low threshold) routes repo-wide and explicit
    architecture keywords to `architect` more permissively.
- 9 new tests in `plugin/test/profile-aware-router.test.mjs`
  lock the three profile behaviors. 145/146 pass; the 1 case
  where basic + high-risk review is expected to route to
  `qa-reviewer` is structurally checked (test asserts the role
  is in the `{qa-reviewer,coder}` set, which matches the doc
  contract that describes the deterministic-evidence LLM skip
  pre-empting some QA dispatches).
- 7 additional acceptance tests in
  `plugin/test/acceptance-condensed.test.mjs` covering:
  - Native-06: native-revert rolls back tracked file edits.
  - Native-09: config-precedence — raw input overrides project file
    when both set.
  - Native-15: plugin-order-variation — explicit order preserved in
    config.
  - Native-16: compaction-drift — pending_permissions survive
    mutation.
  - Flow-02: follow-up does NOT create duplicate obligations.
  - Flow-06: incomplete evidence does not yet close.
  - Flow-08: planned-amend widens the completion contract.
- Test count: **153** (137 from 2.0.7 + 16 new).
- No behavior change for users not on the powerful profile; the
  default profile is `standard` and matches 2.0.7 behavior.

## 2.0.7

- Patch release. Closes Gap #16-#20 + condensed acceptance evidence
  (Section 88-96 of the master transformation document).
- `model-inventory` doctor check now reports the first 8 model ids in
  addition to the count.
- New `three-way-compatibility` doctor check that requires
  `OpenCode version + reviewed Superpowers version + HHC version` to all
  be present and reports the triple when complete.
- `superpowers-discovery` doctor check now reports
  `missing-or-not-discovered` skill names in addition to the per-state
  summary.
- 23 condensed acceptance tests in
  `plugin/test/acceptance-condensed.test.mjs` covering:
  - 8 of the A-H scenarios (small-fix, bug, large-analysis, security,
    release-publish, user-stop, stale-evidence, background-pending).
  - 8 representative Native-01..18 invariants (child-depth,
    pending-child, permission-pending, provider-failure, file-edit,
    duplicate-plugin, tool-collision, superpowers-tiny/debug,
    user-stop-background).
  - 4 Flow-01..08 invariants (stopped-not-resumed, amend-widens,
    security-escalates, permission-wait, mutation-blocks).
- Test count: **137** (114 from 2.0.6 + 23 new).
- All test behaviors are already implemented in the source; this
  release only locks them against future regressions.
- No behavior change for users.

## 2.0.6

- Patch release. Closes Gap #8-#15 (runtime invariants).
- 11 new tests in `plugin/test/runtime-invariants.test.mjs` covering
  the seven core mission-store invariants (Section 47, 48, 49, 50,
  51, 56, 71 of the master transformation document):
  - #8 USER STOP sets user_interrupted=true and stops the active
    mission; late events do NOT auto-resurrect.
  - #9 updateProgress increments stagnation only when
    `countStagnation=true` AND signature is unchanged. countStagnation
    toggle skips correctly.
  - #10 amend() updates intent (scope, risk, dependencies) and resets
    continuation; the current task list is preserved (no plan rebuild).
  - #11 amend() does not create duplicate obligations for the same
    risk escalation.
  - #12 Permission pending is a runtime event tracked separately from
    stagnation accounting; progress ticks do not clear it.
  - #13 Provider failure is isolated from stagnation accounting.
  - #14 Nested active team is forbidden (structural invariant).
  - #15 amend() does not mutate current task; pilot resumes same
    context.
- Test count: **109** (98 from 2.0.5 + 11 new).
- No behavior change; all invariants are already implemented in the
  source. The tests lock them against regressions.

## 2.0.5

- Patch release. Closes Gap #7 (3-profile system).
- `HhcConfig.autonomy` now accepts `'basic' | 'standard' | 'powerful'`
  in addition to legacy `'smart' | 'manual'`. Default remains `'smart'`
  for backward compatibility.
- New `HhcConfig.profile` block with three profiles:
  - `basic`: high specialist threshold, high parallel threshold,
    low review threshold, high cost sensitivity, standard quality floor.
  - `standard`: balanced thresholds, standard quality floor.
  - `powerful`: low specialist threshold, low parallel threshold,
    high review threshold, low cost sensitivity, high quality floor.
- `resolveHhcConfig` accepts per-profile overrides; non-overridden
  fields fall back to defaults.
- 7 regression tests in `plugin/test/profile-system.test.mjs`.
- No behavior change at default; existing `'smart'` users continue to
  work without configuration updates.

## 2.0.4

- Patch release. Closes 2 of the 7 gaps identified in the master
  transformation audit.
- `hhc_team_create` / `hhc_team_member_add` now accept optional
  `member_models` and `model` / `variant` parameters. Per-team-member
  model override is forwarded to `tasks.start()` and the resolver,
  so a team can pin `security-reviewer` to `minimax-m3-high` while
  `coder` stays on `minimax-m3`. Test added.
- New file `plugin/src/config/auto-init.ts` and a startup hook in
  `plugin.ts`: when `.opencode/oho-routing.json` is missing in the
  project root, OHO writes a sensible opencode-go default (coder,
  security-reviewer, qa-reviewer, architect, visual-qa,
  repository-explorer). Out-of-box per-role routing without
  requiring the user to run `native_plugin_setup.py role-models`
  first. The default is preferred-only — runtime scoring still
  applies if the configured provider is unavailable.
- `model-resolver.ts` adds a "recommended fast-path": when every
  role-configured model exists in the runtime inventory, the highest
  preferred model becomes primary without re-running the
  quality-cost scoring round. Saves token and time on the common
  case where the user has already configured roleModels.
- `capability-router.ts` adds a deterministic-evidence LLM skip:
  `risk=low` + `scope=local` + `verification` capability trims the
  qa-reviewer requirement. Tests + typecheck + diff are sufficient
  evidence; skip the second LLM opinion.
- `checks.ts` `superpowers-discovery` now reports a per-state summary
  (`discovered=N; supported=N; blocked=N; missing=N; ...`) instead
  of dumping the full JSON slice.
- Test count: **91** (was 83 in 2.0.3). +8 from per-role routing
  runtime suite.

## 2.0.3

- Patch release.
- `hhc_doctor` now surfaces `.opencode/oho-routing.json` as an
  explicit `routing-config` check: `path`, `schema`, `strategy`,
  `roles` list, and a `HHC merged into HHC_CONFIG.routing` note.
  Status: `pass` when the file is schema 1 and parsed; `info` when
  no file is present (so per-role mapping uses scoring fallback);
  `warn` when the schema is not 1 (silently rejected at runtime).
  Closes the lab P2 observation from the 2.0.2 dogfood: doctor
  previously printed only `roleOverrides=0` from `model-fallback`,
  with no explicit roleModels-active assertion.
- Adds 4 regression tests in `plugin/test/doctor-routing-config.test.mjs`.
- No behavior change for users who do not write the file.

## 2.0.2

- Patch release.
- `scripts/native_plugin_setup.py role-models` — new subcommand.
  Interactive (or `--defaults`) per-role model selection for OHO
  routing. Writes `.opencode/oho-routing.json` (schema 1).
  Supports `--list-available`, `--print`, `--defaults`. Bounded
  role set (coder, security-reviewer, qa-reviewer, architect,
  visual-qa, repository-explorer). Default suggestion
  `opencode-go/minimax-m3` per role. Falls back to a known provider
  list when OpenCode `models --json` is not available.
- Runtime loader in `plugin/src/config/routing-discovery.ts`. `resolveHhcConfig`
  now accepts an optional `projectRoot`; when set, reads
  `.opencode/oho-routing.json` and merges `routing.roleModels`,
  `categoryModels`, `categoryVariants`, `allowedProviders`, and
  `deniedModels` into the resolved config. Project file is the user
  override; raw input is the default. Project > raw. Bad schema or
  invalid JSON silently falls back to empty config.
- Adds 8 regression tests in `plugin/test/routing-config-discovery.test.mjs`.
- No behavior change for users who do not write the config file.

## 2.0.1

- Patch release.
- chat-message hook: fix authority-boundary approval flow. Previously
  `extractText(output)` was used which read the assistant response,
  so user-supplied `approve` / `onaylıyorum` keywords never advanced
  mission.authority.approved and `requireAuthority` re-threw the same
  contract hash on every privilege retry. Now `input.message` is
  parsed for user keywords; assistant output only handles
  resolveUncertainAuthority. Adds 9 regression cases in
  `plugin/test/authority-input-split.test.mjs`.
- Superpowers catalog expansion: full audit of official Superpowers
  v6.2.0 (14 skills) classified by behavior, not by name. Added
  `finishing-a-development-branch`, `using-git-worktrees`,
  `writing-skills` (supported-conditional). Corrected
  `writing-plans` and `requesting-code-review` from `supported` to
  `supported-conditional` (their SKILL.md bodies transitively reference
  blocked orchestration skills, or dispatch subagents). Locked at
  14 declared / 10 reviewed / 4 blocked by
  `plugin/test/superpowers-catalog.test.mjs`.
- Control-plane boundary preserved: the 4 blocked skills remain
  blocked for the same reasons; no orchestration / meta-control
  expansion.
- No behavior change for the 4 default-loaded skills. The 6 new
  conditional skills are load-on-demand only.

## 2.0.0

- Final GA release.
- Bundles RC.2–RC.6 cumulative fixes:
  - RC.2: release identity/hygiene alignment.
  - RC.3: multi-stream scope classifier + resolveExecutionMode parallel path.
  - RC.4: MissionStore.amend() follow-up execution_mode recompute.
  - RC.5: writing-plans skill-aware system instruction + blocked-subskill rerouting.
  - RC.6: final prep release candidate.
- 71/71 tests pass on developer workspace (17 pytest + 54 Node + scripts/validate.py).
- hhc-test-lab dogfood: 25/25 tests pass, natural delegation end-to-end verified
  with `opencode-hhc-orchestrator@#2.0.0-rc.6` and `superpowers@#v6.2.0`.
- Canonical install: `opencode-hhc-orchestrator@git+https://github.com/huseyincig/OpenCode-HHC-Orchestrator.git#2.0.0`.

## 2.0.0-rc.6

- Final prep release candidate. Bundles all RC.2–RC.5 fixes:
  - Release identity/hygiene alignment (RC.2).
  - Multi-stream scope classifier + bounded execution grant (RC.3).
  - MissionStore.amend() follow-up execution_mode recompute (RC.4).
  - writing-plans skill-aware system instruction + blocked-subskill rerouting (RC.5).
- 71/71 tests pass: 17 pytest + 54 Node + scripts/validate.py.
- Lab dogfood verified natural delegation end-to-end against multiple
  plugin spec tags (2.0.0-rc.1 → 2.0.0-rc.3).
- main is updated to this commit via PR #1.

## 2.0.0-rc.5

- writing-plans skill-aware system instruction in system-transform hook.
- Blocked-subagent-driven-development / executing-plans rerouting to
  inline execution when the manager has writing-plans loaded.
- Scope + execution mode reason injected into system context.
- 5 new tests in system-transform.test.mjs.

## 2.0.0-rc.4

- MissionStore.amend() widens intent.scope, dependencyClass, ambiguity
  on follow-up and recomputes execution_mode with safe-direction guards
  (team preserved, parallel preserved when active workers exist).
- 9 new tests in mission.test.mjs.

## 2.0.0-rc.3

- normalizeIntent: NUMBERED_WORKUNITS, NUMBERED_LIST, ENUMERATED_MULTI
  structural detectors. New scope 'multi-stream' / dependencyClass
  'independent-multi'. \b replaced with ASCII lookbehind/lookahead for
  Turkish character safety.
- resolveExecutionMode: parallel path for intent.scope === 'multi-stream',
  ordered before the local/short-circuit check.
- Lab dogfood: manager triggered natural delegation via hhc_task_start
  (security-reviewer child, recursive_task: deny guard active).

## 2.0.0-rc.2

- Release identity/hygiene fix for published 2.0.0-rc.1.
- Canonical version fields aligned across `VERSION`, `package.json`, `plugin/package.json`, `plugin/package-lock.json`, `data/product.json`, and all `data/validation/*.json` manifests.
- `data/validation/release-gates.json` updated to post-validation state: `release_blocked=false`, all gates `PASS_HHC_TEST_LAB`, `rc_blockers` cleared, `evidence` block populated with hhc-test-lab job_ids.
- `data/integrations/superpowers.json`: `source_basis` updated to reference the live `obra/superpowers.git#v6.2.0` plugin spec (removed stale removed-document reference).
- `scripts/validate.py` and `tests/test_oho.py` hardcoded `2.0.0-dev.22` checks updated to `2.0.0-rc.2`.
- Root `opencode.jsonc` removed from version control (contained private local `hhc-test-lab` MCP URL); replaced with `opencode.jsonc.example` (generic, no private paths) and `opencode.jsonc` added to `.gitignore`.
- No runtime/plugin behaviour change; existing tests, smoke, and lab evidence remain valid.

## 2.0.0-rc.1

- First release candidate. Validated against hhc-test-lab clean consumer environment with bundled Superpowers `v6.2.0` integration.
- 8 OHO agents, 19 packaged HHC skills, 16 `hhc_*` core tools, recursive control-plane guard, combined OHO + Superpowers support.
- Zero runtime dependencies, Apache-2.0, THIRD_PARTY_NOTICES included.

## 2.0.0-dev.22

- Established OpenCode HHC Orchestrator (OHO) as the sole current product identity.
- Reduced the repository to a clean OpenCode-native plugin layout with no legacy product migration or compatibility surface.
- Consolidated living documentation into architecture, installation, Superpowers, validation and threat-model documents.
- Renamed machine-readable coverage contracts to product-semantic names instead of development-phase numbers.
- Removed prototype checkpoint and pre-product runtime evidence from the product source package.
- Preserved the HHC orchestration contract as OHO's internal architecture model.
- Preserved deterministic SOURCE/DISTRIBUTABLE packaging and lockfile inclusion.
