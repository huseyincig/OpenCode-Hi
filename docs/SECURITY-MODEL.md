# Security model

OpenCode-Hi treats host permissions, user-owned files, credentials, external effects, and evidence as explicit trust boundaries. The public security model describes **current behavior**; historical threat-model work is not a second source of product truth.

## Trust boundaries

- OpenCode host denial is authoritative. Hi may narrow authority but never widen a deny.
- Push, tag, publish, deploy, paid actions, credential operations, and other supported external effects require the matching authority path.
- Reviewer roles are read-only; child workers cannot invoke Hi control-plane tools.
- User dirty/staged/unrelated files are preserved and cannot be silently absorbed into Hi-owned changes.
- Workspace, process, and browser ownership are identity-bound and fail closed on substitution or stale ownership.
- Provider-facing context passes through the privacy boundary; secrets must not become durable logs, mission state, telemetry, or artifacts.
- Project methodologies/skills do not gain trust merely because files exist in the repository. Admission, permission, and execution remain separate decisions.
- Package/release completion requires source/ref/package/registry evidence appropriate to the claimed tier.

## Persistence and privacy

Hi persists semantic runtime state needed for recovery, but executable environment secrets are ephemeral. Durable state is schema-validated and rejects unsupported or malformed current-state envelopes. Project-local Hi data stays under the Hi-owned project storage boundary; host-native OpenCode directories remain host-owned.

## Reporting vulnerabilities

Follow [`.github/SECURITY.md`](../.github/SECURITY.md). Do not place credentials, private source, or exploit secrets in a public issue.

## Verification

Security-sensitive invariants are covered by the canonical test and validation gates described in [Verification](VERIFICATION.md). Exact host and publication claims require the corresponding external evidence tier.
