# OpenAgentsControl

Status: VERIFIED STUDY PASS 1

## Identity

- Canonical repository: `darrenhinde/OpenAgentsControl`
- Reference action: ADAPT
- Reuse boundary: use architecture patterns only; preserve Hi semantic/authority rules.

## Source surfaces inspected

- `.opencode/plugin/agent-validator.ts`
- `.opencode/context/openagents-repo/core-concepts/agent-metadata.md`
- repository search results for context guides and planning-agent definitions.

## Verified source facts

- OpenCode-valid agent frontmatter is deliberately separated from richer product registry metadata.
- Central metadata contains IDs, display names, categories, version, tags and dependencies; an auto-detect step merges frontmatter + registry metadata.
- The validator observes chat/tool events and attempts to validate approval/delegation behavior.
- The current approval implementation uses natural-language keyword lists for request/approval detection.

## Useful engineering patterns

- Separate host schema projection from product/domain metadata.
- Maintain a canonical registry that can mechanically compare host projection against product contract.
- Agent/component dependency metadata can be validated independently from model-facing prose.

## Foreign / accidental semantics to reject

- **Reject natural-language keyword approval detection.** It is language-specific, ambiguous and unsafe for authority.
- Do not copy category/persona ontology merely because upstream uses it.
- Do not make registry metadata another hand-maintained truth; Hi should generate/validate projections from one canonical RoleContract.

## Hi mapping

- Strong evidence for `RoleContract -> HostAgentProjection -> generated OpenCode agent -> parity validator`.
- Strong evidence that host frontmatter must contain only host-valid fields.
- Authority remains structured/exact in Hi; semantic intent remains primary-model owned.

## Open questions

- Determine which registry fields are truly useful to Hi discovery versus documentary metadata before defining schema fields.
