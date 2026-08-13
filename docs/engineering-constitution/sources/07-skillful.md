# opencode-skillful

Status: VERIFIED STUDY PASS 1

## Identity

- Canonical repository: `zenobi-us/opencode-skillful`
- Reference action: ADAPT

## Source surfaces inspected

- `src/services/SkillRegistry.ts`
- service inventory: `SkillSearcher`, `SkillResourceResolver`, ready state, filesystem utilities and tests.

## Verified source facts

- Skill discovery, parsing/cataloging, resource mapping, search and readiness are separate responsibilities.
- Frontmatter is schema-validated; malformed skills can be rejected while registry initialization continues.
- Resources are indexed at parse time to prevent arbitrary path traversal through the resource reader.
- Registry has explicit loading/ready/error state.
- Skill description has a minimum discoverability constraint.

## Useful engineering patterns

- Methodology registry lifecycle should have explicit readiness/admission/error state.
- Resource resolution must be constrained to registered resources, not arbitrary relative paths.
- Discovery metadata and full methodology body are separate; lazy load is desirable.
- Per-component parse failure should not necessarily destroy the entire registry, but admission policy must be explicit.

## Foreign / accidental semantics to reject

- Last-one-wins duplicate semantics are unsafe for Hi project methodology collisions; Hi correctly fails closed on conflicting canonical names.
- Natural-language search is not itself methodology selection authority; Hi semantic assessment remains owner.

## Hi mapping

- Strong support for MethodologyContract + ResourceManifest + admission state + lazy host projection.
- Project methodology collision/provenance/hash rules remain stricter than upstream.
