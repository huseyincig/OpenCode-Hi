# Filesystem Layout and Installation Hygiene

OpenCode-Hi is a guest of the host project. Project-local installation must not unpack product source or create product-owned directories in the repository root.

## Project-local layout

The only project-root file OpenCode-Hi setup may create or modify is the canonical OpenCode project configuration file when registration requires it:

```text
<project-root>/opencode.json
```

All other OpenCode-Hi-owned project data lives below:

```text
<project-root>/.opencode/hi/
```

Canonical Hi-owned locations are:

```text
.opencode/hi/policy/                         # project execution/routing/authority policy
.opencode/hi/policy/methodologies/           # admission policy for Hi project methodologies
.opencode/hi/artifacts/                      # durable artifact handles and project-scoped results
.opencode/hi/project-intelligence/
.opencode/hi/provenance/                     # setup/ownership/source binding
.opencode/hi/provenance/methodologies/       # evidence-backed project methodology provenance
```

Project-created reusable methodologies use OpenCode's native skill location and are never unpacked into a Hi-owned duplicate tree:

```text
.opencode/skills/hi-project-<purpose>/SKILL.md
```

Responsibilities owned by OpenCode use OpenCode-native directories instead of Hi-specific substitutes:

```text
.opencode/plugins/
.opencode/skills/
.opencode/agents/
.opencode/commands/
.opencode/tools/
```

OpenCode-Hi must not create project-root `plugin/`, `plugins/`, `skills/`, `agents/`, `runtime/`, `state/`, `cache/`, `logs/`, `hhc-*`, or `hi-*` directories in a consumer repository.

## Package installation

Package-based installation registers the plugin through OpenCode's package/plugin resolver. OpenCode-Hi does not unpack its source tree into the consumer project. Resolver-managed package/cache placement belongs to OpenCode and the package manager.

## Runtime and transient data

Secrets are never persisted in project files. Mission-survival state is correctness-required across compaction/restart but is runtime/session data, not project knowledge. It is stored in a project-keyed OS/OpenCode state location (see `STORAGE-ARCHITECTURE.md`), never under the consumer repository. Runtime/process transient lifecycle journals use memory or OS temporary/runtime locations. The installer is the deliberate exception: `.opencode/hi/provenance/setup-transaction.json` is project-local only while a registration mutation needs cross-process crash recovery, contains no config body/secrets, and is removed on normal completion/recovery. Caches and logs must use OpenCode/OS cache or data locations when introduced.

Projects that version `.opencode/` should explicitly decide whether durable Hi policy/provenance belongs in version control. Runtime/session state is outside the repository and secret material must never be committed.

## Global installation

Global registration must use OpenCode's global configuration hierarchy. Persistent global Hi data, caches, and temporary state belong in the corresponding OpenCode or OS-specific config/data/cache locations, not in an arbitrary source repository.

## Uninstall ownership

Uninstall removes the OpenCode-Hi plugin registration plus active setup-owned `.opencode/hi/provenance/setup.json`; it retains one bounded `.opencode/hi/provenance/setup-rollback.json` registration rollback point and leaves no transaction journal after normal completion. The rollback metadata contains no copied config body or secrets. It preserves independently-owned `.opencode/hi/policy/` (including routing and Authority projection), methodology policy/provenance, retained `.opencode/hi/project-intelligence/`, `.opencode/hi/artifacts/`, project-created `.opencode/skills/`, unrelated `opencode.json` fields, foreign plugins, MCP configuration, themes, OpenCode-native `.opencode/*` directories, and unrelated project-root files. Durable project knowledge/artifacts require an explicit purge/delete operation rather than being coupled to plugin uninstall.

Filesystem hygiene is a release gate and is covered by install, doctor, reconfigure, and uninstall tests.
