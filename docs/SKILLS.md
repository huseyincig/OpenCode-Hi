# Hi Methodologies and OpenCode Skills

OpenCode-Hi treats **methodology** as the product concept and **skill** as the OpenCode host primitive used to load methodology content lazily.

Built-in Hi methodologies are packaged under `skills/hi-*/SKILL.md`. Their canonical machine contract is `data/hi-methodologies.json`; build-time generation validates each SKILL contract against its purpose, trigger, do-not-trigger rule, exit condition, preferred/compatible roles, trigger sources, costs, composition metadata, and native role permissions. Generated runtime policy is derived from that contract and is not hand-edited.

Default active methodology count is 0, typical work uses 0–1, and the hard active maximum is 3. Catalog metadata is cheap; full SKILL.md bodies and bounded `references/`, `scripts/`, `assets/`, or `examples/` resources are loaded only when Hi selects the methodology and OpenCode invokes its native skill surface.

Methodologies contain HOW only. They do not own routing, model selection, topology, authority, continuation, obligation completion, or STOP.

## Project-learned methodologies

A project-specific reusable way of working uses the canonical name `hi-project-<purpose>` and is admitted only when all three artifacts agree:

```text
.opencode/skills/<name>/SKILL.md
.opencode/hi/policy/methodologies/<name>.json
.opencode/hi/provenance/methodologies/<name>.json
```

The OpenCode skill file contains methodology and bounded resources. The Hi policy sidecar declares enabled state, preferred/compatible roles, trigger sources, costs, priority, and admission mode. The provenance sidecar records whether the methodology came from explicit user intent or evidence-backed project learning and names the evidence used to justify it.

OpenCode may discover other project or personal skills, but discovery does not grant Hi auto-selection authority. Hi auto-selects only built-in methodologies or valid `hi-project-*` methodologies with a complete admission contract and provenance. Same-name provider collisions fail closed; project files do not silently override built-in Hi methodologies.

`hi-methodology-authoring` is used only when a reusable procedure is explicitly requested or repeated project evidence demonstrates a genuine methodology gap. One-off facts belong in Project Intelligence or evidence, not in a new methodology.

## Native skill selection

Hi does not maintain a second persistent OpenCode skill index. `plugin/src/runtime/skills/registry.ts` derives bounded candidates only for methodologies already admitted by the canonical methodology catalog, validates provider/path/frontmatter/resource boundaries, applies the effective OpenCode skill permission map, and returns the minimum selected set. Built-in methodology metadata comes from generated policy; valid `hi-project-*` methodology policy/provenance may add project candidates.

Full `SKILL.md` content is still loaded through OpenCode's native skill primitive only after selection. Discovery by OpenCode alone grants no Hi activation authority, same-name/provider collisions fail closed, and unrelated skills are not copied into the Hi prompt surface.
