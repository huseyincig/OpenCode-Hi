# opencode-vibeguard

Status: VERIFIED STUDY PASS 1

## Identity

- Canonical repository: `inkdust2021/opencode-vibeguard`
- Reference action: ADAPT

## Source surfaces inspected

- `src/engine.js`
- source inventory: `patterns.js`, `restore.js`, `session.js`, `deep.js`, `config.js`, `index.js`.

## Verified source facts

- Redaction uses deterministic keyword/regex match spans and resolves overlapping ranges before inserting stable session placeholders.
- Session-scoped placeholder mapping enables local restoration without sending the original secret through the protected boundary.
- Pattern, engine, session and restore concerns are separated.

## Useful engineering patterns

- Privacy transformation should happen at the provider boundary, before retention/network transmission.
- Redaction identity and restoration state belong to a bounded session context.
- Overlapping secret matches must not corrupt placeholders.

## Foreign / accidental semantics to reject

- Secret/PII pattern catalogs are domain/security data, not user-intent semantics; do not generalize regex use into semantic routing.
- Do not assume every external pattern category should be copied; Hi's privacy boundary owns the supported classes.

## Hi mapping

- Confirms current Privacy Boundary placement around provider prompts and retained artifact content.
- Future PrivacyContract should define classification source, transformation, restoration eligibility, retention and audit behavior.
