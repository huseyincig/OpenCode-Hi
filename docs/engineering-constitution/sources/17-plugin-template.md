# opencode-plugin-template

Status: VERIFIED STUDY PASS 1

## Identity

- Canonical repository: `zenobi-us/opencode-plugin-template` (archived)
- Reference action: ADAPT

## Source surfaces inspected

- repository root: `setup.sh`, `template/`, `.opencode/`, README.

## Verified source facts

- The project is explicitly a scaffold/template with setup automation and a separated template tree.

## Useful engineering patterns

- A reusable plugin template should encode packaging/setup conventions so new plugins do not reconstruct them ad hoc.
- Template quality is part of engineering governance, not only documentation.

## Foreign / accidental semantics to reject

- Archived scaffold specifics should not define current OpenCode API behavior.
- Do not copy its directory tree blindly; extract only still-valid package/release hygiene after comparison with current OpenCode/plugin package requirements.

## Hi mapping

- Supports creation of canonical component templates/generators, but current OpenCode-Hi package/runtime is the implementation baseline.
