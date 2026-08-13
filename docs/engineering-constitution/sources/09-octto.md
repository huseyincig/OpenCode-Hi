# octto

Status: VERIFIED STUDY PASS 1

## Identity

- Canonical repository: `vtemian/octto`
- Reference action: ADAPT

## Source surfaces inspected

- `src/tools/questions.ts`
- referenced factory/session/type infrastructure.

## Verified source facts

- Human questions are typed by interaction form: pick-one, pick-many, confirm, rank, rate, text, image, file, code, etc.
- Tool schemas validate option cardinality, min/max relationships and typed response shapes.
- Question rendering config is produced from structured arguments rather than inferred from arbitrary prose.

## Useful engineering patterns

- Human interaction should use structured decision contracts and typed response shapes.
- Interaction type and semantic decision type are separate dimensions.

## Foreign / accidental semantics to reject

- A `confirm` UI response does not automatically confer Hi authority for an external action.
- UI interaction catalog must not become product ontology.

## Hi mapping

- HumanDecisionContract should drive host-specific question UI projections.
- AuthorityContract remains exact-action-bound and separate from general user preference/confirmation.
