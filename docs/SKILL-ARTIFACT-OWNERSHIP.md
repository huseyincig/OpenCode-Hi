# Skill & Artifact Ownership Audit

This audit maps every canonical `hi-*` methodology to the artifacts it can cause the system to read, create, modify, or retain. **Skills do not own storage merely because they produced an output.** Storage follows the semantic owner, scope, lifecycle, and sensitivity of the resulting data.

## Canonical rule

- Existing project source/document/test files remain repository-owned canonical data.
- Project-created reusable methodology uses OpenCode-native `.opencode/skills/<skill>/`.
- Reusable evidence-backed project knowledge uses `.opencode/hi/project-intelligence/` only when actually persisted.
- Durable long-form mission outputs use `.opencode/hi/artifacts/` only when retention is materially useful.
- Policy and provenance use their dedicated Hi areas.
- Context fragments, raw logs, process metadata, redaction mappings, and other transient material stay in memory/host/OS runtime locations.
- No skill gets a private storage directory merely because it exists.

## Complete 27-methodology audit

| Skill | May produce / modify | Semantic owner | Scope | Default lifecycle | Storage decision |
|---|---|---|---|---|---|
| hi-accessibility-review | verification evidence; optional review report | runtime evidence by default | MISSION | ephemeral; durable only if explicitly retained | ContextArtifactStore when retained |
| hi-adversarial-validation | challenge findings; reconciliation evidence | runtime evidence by default | MISSION | ephemeral; durable high-stakes report when required | ContextArtifactStore when retained |
| hi-api-contract-review | contract findings; tests; possible source edits | repository + mission | PROJECT/MISSION | repo files canonical; findings ephemeral/durable on demand | repository / ContextArtifactStore |
| hi-api-interface-design | interface/schema design; acceptance contract | project decision or implementation artifact | PROJECT | durable when decision has future consequence | Project Intelligence or repository canonical docs |
| hi-architecture-decisions | decision, alternatives, consequences, evidence | project knowledge | PROJECT | durable | Project Intelligence |
| hi-browser-testing | console/network/rendering evidence; screenshots | tool/runtime evidence | MISSION | ephemeral by default; retained evidence may be artifact | OpenCode tool output / ContextArtifactStore |
| hi-changelog-and-documentation | README/changelog/docs edits | repository canonical files | PROJECT | durable canonical source | repository paths |
| hi-ci-build-recovery | logs, failure classification, source/config fix | runtime evidence + repository edits | MISSION/PROJECT | logs ephemeral; fixes canonical; long diagnosis optional artifact | runtime / repository / ContextArtifactStore |
| hi-code-review | review findings and disposition | mission evidence | MISSION | ephemeral by default; retained review optional | ContextArtifactStore when retained |
| hi-database-migration | migration files, backfill scripts, plan/evidence | repository canonical files + mission evidence | PROJECT | migration files durable canonical; plan optional artifact | repository / ContextArtifactStore |
| hi-debugging-root-cause | hypotheses, reproductions, logs, fix | mission evidence + repository edits | MISSION/PROJECT | debug traces ephemeral; fix canonical; RCA optional artifact | runtime / repository / ContextArtifactStore |
| hi-dependency-change | manifest/lock/config changes; compatibility evidence | repository canonical files | PROJECT | durable canonical files | repository paths |
| hi-design-discovery | constraints, preference/authority decisions | mission decision; durable project decision if adopted | MISSION/PROJECT | ephemeral until adopted; adopted durable decision | MissionState / Project Intelligence |
| hi-implementation-planning | dependency-oriented implementation plan | mission artifact | MISSION/PROJECT | no plan for direct work; durable only when coordination value persists | ContextArtifactStore when plan artifact justified |
| hi-iterative-retrieval | retrieved fragments, compacted facts, paths | context only | SESSION/MISSION | ephemeral | memory/host context; no project directory |
| hi-performance-analysis | measurements, profiles, bottleneck findings | runtime evidence | MISSION | raw profiles ephemeral; retained report optional artifact | OS/tool output / ContextArtifactStore |
| hi-regression-review | regression findings and evidence | mission evidence | MISSION | ephemeral by default; optional review artifact | ContextArtifactStore when retained |
| hi-release-guardrails | manifest/SBOM/hashes/release receipts | release evidence | RELEASE | durable release output, never consumer runtime | release workspace |
| hi-repository-analysis | file/symbol/dependency map; discovered conventions | context + possible project knowledge | MISSION/PROJECT | map ephemeral; reusable evidenced convention may become PI | memory / Project Intelligence |
| hi-review-feedback | finding classification, fixes, scoped verification | mission evidence + repository edits | MISSION/PROJECT | classification ephemeral; fixes canonical | runtime / repository |
| hi-safe-refactoring | source edits and verification evidence | repository canonical files | PROJECT | source durable canonical; evidence mission-scoped | repository / MissionState |
| hi-security-review | security findings, synthetic leak evidence, fixes | sensitive mission evidence + repository edits | MISSION/PROJECT | raw sensitive data never durable; sanitized retained report optional | memory/privacy boundary / repository / ContextArtifactStore sanitized only |
| hi-methodology-authoring | SKILL.md and skill references/scripts/examples/assets | OpenCode-native skill capability | PROJECT/PACKAGE | durable canonical methodology | project: .opencode/skills/<skill>/; bundled: package skills/<skill>/ |
| hi-source-driven-development | source reuse decision, license/provenance, tests | project/release provenance + mission evidence | PROJECT/RELEASE | reuse/provenance durable when implementation depends on it | Hi provenance / repository docs / release workspace |
| hi-test-driven-development | tests and implementation edits | repository canonical files | PROJECT | durable canonical code/tests | repository paths |
| hi-test-strategy | verification plan and evidence requirements | MissionState | MISSION | ephemeral unless complex plan retained | MissionState / ContextArtifactStore when justified |
| hi-visual-qa | visual evidence, screenshots, diff findings | tool/runtime evidence | MISSION | ephemeral by default; retained visual evidence optional | OpenCode/tool output / ContextArtifactStore |

## Consequences for the filesystem hierarchy

The complete skill inventory converges on a small number of shared ownership families rather than 29 skill-specific folders:

```text
<project-root>/
  opencode.json                         # only when OpenCode project config is selected
  .opencode/
    skills/                             # OpenCode-owned capability; project-created skills live here
      <project-created-skill>/
        SKILL.md
        references/                     # only when needed
        scripts/                        # only when needed
        examples/                       # only when needed
        assets/                         # only when needed
    hi/
      policy/                           # explicit durable Hi project policy
      provenance/                       # Hi/source/setup provenance
      project-intelligence/             # created lazily only when PI is durably persisted
        patterns/
      artifacts/                        # created lazily only for retained long-form outputs
        <semantic-kind>/                 # e.g. review, research, plan; kind is not a skill name
```

Directories are created lazily by the owning capability. File format never determines placement. Temporary context/document transformations never create a generic `context/` or `markdown/` project directory.

## Document/context examples

- Markdown cleanup used only for the current model handoff -> **ephemeral runtime/context**, no project file.
- A cleaned document distilled into a reusable project convention -> **Project Intelligence**, source-hash linked and invalidatable.
- A long repository audit explicitly retained for later use -> **ContextArtifactStore**, with hash/provenance and semantic artifact kind.
- A retained browser screenshot -> **ContextArtifactStore**, with the ArtifactContract JSON manifest as canonical metadata plus one bounded hash-bound PNG sibling; raw image bytes never enter BrowserObservation or Evidence automatically.
- Reusable methodology derived from an external document -> merge an existing skill or create `.opencode/skills/<skill>/`; its references stay with that skill.
- Sensitive local text/redaction mappings -> **memory only**, never project-visible durable storage.

## Uninstall ownership consequence

Uninstall removes setup-owned registration/config/provenance surfaces. It does **not** delete project-created skills, durable project intelligence, or retained artifacts merely because they are under OpenCode/Hi namespaces. Those have distinct ownership and require an explicit future purge/delete operation if removal is desired.
