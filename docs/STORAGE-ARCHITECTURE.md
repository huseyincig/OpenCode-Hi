# Storage Architecture

OpenCode-Hi places data by **capability ownership and lifecycle**, never by file type. The hierarchy below is derived from implemented responsibilities; no empty directory tree is created proactively.

## Storage classes

- **OpenCode-native capability** — plugin registration, packaged skills/agents and future native commands/tools remain owned by OpenCode/package resolution. Hi does not mirror them under `.opencode/hi/`.
- **Hi project-owned durable data** — explicit project policy and Hi setup/source provenance may live under `.opencode/hi/`.
- **Hi skill-owned resources** — references/scripts/examples/assets remain inside the owning `hi-*` skill package.
- **Runtime/session state** — correctness-required mission survival is project-keyed but stored in the OS/OpenCode state area, not the repository.
- **Sensitive/transient data** — secret redaction mappings, process handles, temporary context transforms and lifecycle journals are memory-only or OS runtime/temp data.
- **Release outputs** — source/distributable ZIPs, manifests, SBOMs and receipts belong to the release workspace, never consumer project runtime paths.

## Canonical project-local layout

Only implemented durable responsibilities are permitted:

```text
<project-root>/
  opencode.json                  # only when the selected OpenCode project config mode requires it
  .opencode/
    hi/
      policy/
        routing.json             # only after explicit project-policy configuration
        authority.json           # explicit native-always authority projection; never contains credentials
        methodologies/           # admitted project-methodology policy; project-authoring owned
      provenance/
        setup.json               # active installer ownership/source binding
        setup-transaction.json   # transient crash-recovery metadata; absent after normal completion
        setup-rollback.json      # exactly one bounded registration rollback point
        methodologies/           # hash-bound project-methodology provenance; project-authoring owned
      project-intelligence/      # lazily created only when durable PI/learning state is written
        patterns/
        methodology-candidates/
      artifacts/                 # lazily created only when a durable artifact is retained
        <semantic-kind>/
    skills/
      hi-project-<purpose>/      # OpenCode-native project methodology; NOT Hi internal storage
        SKILL.md
```

No runtime directory is required inside `.opencode/hi/`. Mission survival state is stored outside the repository in a project-keyed OS state path.

OpenCode-owned `.opencode/plugins/`, `.opencode/skills/`, `.opencode/agents/`, `.opencode/commands/`, and `.opencode/tools/` are not Hi-owned storage. Package installation registers `opencode-hi` through OpenCode's resolver rather than unpacking plugin source into the consumer project.

## Runtime state location

Runtime persistence is ephemeral/session-scoped data with a restart-survival requirement. It therefore uses a project-keyed OS state directory:

- `OPENCODE_HI_STATE_DIR` when explicitly configured for testing/embedding;
- otherwise `XDG_STATE_HOME/opencode-hi/projects/<project-hash>/` on XDG systems;
- otherwise `LOCALAPPDATA/OpenCode-Hi/state/projects/<project-hash>/` on Windows;
- otherwise `~/.local/state/opencode-hi/projects/<project-hash>/`.

The project hash is derived from the resolved project root. Raw project paths are not used as directory names.

## Canonical vs derived

Project policy is canonical user/project intent. Setup provenance is canonical ownership metadata. Project Intelligence and durable ContextArtifactStore support lazy project persistence when a project root is explicitly supplied. Project Intelligence records remain source-hash linked and can become `POTENTIALLY_STALE`; ContextArtifactStore records carry content hashes and source-file bindings. Without a project root, both stores remain in-memory. Semantic extraction is derived and disposable. Context compaction output is session context, not project knowledge. Memory is optional and provider-owned; it never satisfies verification.

## Skill resources

Reusable methodology stays with its skill, for example `skills/hi-*/references/`, `scripts/`, `examples/`, and `assets/`. Runtime skill APIs are path-confined and may not expose arbitrary project filesystem paths.

## Cleanup

Uninstall removes the setup-owned plugin registration and active `provenance/setup.json`, while retaining one bounded `provenance/setup-rollback.json` point for immediate lifecycle rollback; no config body or secret backup is stored. A normal operation leaves no `setup-transaction.json`. Project routing policy, native-always Authority projection, durable Project Intelligence, methodology learning/admission state, retained artifacts, and project-created skills under `.opencode/skills/` are preserved because their owners/lifecycles are independent from plugin registration. Removing those requires an explicit owner/purge operation, not installer cleanup. OS runtime state is cleaned by the runtime state owner when obsolete; diagnostics may report orphan state.

Legacy HHC/OHO layouts are **not migrated**. They are historical provenance only and are not accepted as OpenCode-Hi input.
