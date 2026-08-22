# Release Engineering

OpenCode-Hi preserves deterministic source/distributable artifacts, manifest, SBOM, hashes, clean-candidate validation, and forensic candidate binding from the proven baseline. Publishing is authority-gated and must not rely on long-lived secrets when trusted/OIDC publishing is available.

A release candidate may be called release-ready only when all mandatory internal gates are green and required external OpenCode/clean-install receipts are bound to that exact candidate. If the environment prevents a required external receipt, the release remains pending; the acceptance bar is not lowered.

## Current release status

The block below is generator-owned. Do not hand-edit current release status, current reference-host version, or test counts here.

<!-- BEGIN GENERATED RELEASE STATUS -->
## Current release status — generated

- Release candidate: `0.2.4` (`v0.2.4`) — **PREPUBLICATION_CERTIFICATION_IN_PROGRESS**.
- Historical `v0.1.0` remains immutable and is not retagged or source-substituted.
- GitHub candidate: **PENDING_T4**; npm candidate: **PENDING_T4**.
- Prepublication certification is still in progress; publication is not authorized by this projection.
- Reference host baseline: OpenCode `1.18.19` on `linux/aarch64`; historical capability receipts are baseline provenance only. Current candidate exact-source status comes from `data/validation/release-gates.json`.
- Test counts are intentionally not persisted here; final certification owns fresh totals.
- Machine source: `data/validation/release-status-0.2.4.json`.
<!-- END GENERATED RELEASE STATUS -->


## OpenCode upstream-version gate

OpenCode publishes stable versions frequently, so the candidate keeps **two separate truths** instead of silently following `latest`: the exact SDK/plugin host target in `package.json`, and a read-only observation of the current stable upstream release. Run `npm run host:check-update` to compare the exact target with `opencode-ai`, `@opencode-ai/sdk`, and `@opencode-ai/plugin`, bind exact upstream tags, and classify the source delta. Run `npm run host:observe-update` when the observation should also be refreshed under `data/validation/`.

A newer upstream version never promotes support automatically. Metadata/test/document-only deltas require no host re-certification; known capability-surface deltas select only the affected fresh-consumer/T3 boundaries; changes under an unclassified critical OpenCode source root require manual review. Registry skew between the CLI, SDK, and plugin fails closed. Release preflight also requires the exact candidate target to equal the current stable registry version before it performs the expensive canonical release checks.

Exact host downloads are integrity-bound by `data/opencode-host-assets.json`, generated from an immutable official OpenCode GitHub release and tied to the exact package target/tag/source commit. This keeps platform SHA-256 data centralized while preserving exact-version T3 provenance.

## npm Trusted Publishing / OIDC boundary

R1 adds a dedicated `.github/workflows/npm-publish.yml` executor for future npm releases. It is intentionally not a second release-state owner: Hi's canonical release-chain remains responsible for fresh pack identity/integrity and registry equality, while the GitHub workflow supplies the external OIDC execution path. The workflow is restricted to a non-prerelease GitHub `release.published` event in `huseyincig/OpenCode-Hi`, uses a GitHub-hosted Ubuntu runner, grants only `contents: read` plus job-scoped `id-token: write`, carries no npm write token secret, requires Node/npm versions compatible with npm Trusted Publishing, checks out the exact release tag, and fails closed unless that tag is annotated, resolves to checked-out HEAD, and exactly matches `VERSION`, root/runtime/lock package versions, and the canonical repository URL. A fresh `npm pack --dry-run --json` proof is captured before `npm publish`; publication is not accepted until `npm view` returns the same version, integrity and shasum and a fresh consumer can install/import the registry package.

Historical `v0.1.0` remains immutable at released source `f1a2c1c4358e5a63656da7a585b6b5793d1ed3be`; its historical npm absence is preserved only in the immutable 0.1.0 receipts. For the current release, the npm package namespace was bootstrapped once with prerelease `0.0.0-oidc-bootstrap.0` under the non-default `oidc-bootstrap` dist-tag so npm could create the Trusted Publisher relationship. `v0.1.1` / `opencode-hi@0.1.1` was then published through GitHub Actions OIDC from `.github/workflows/npm-publish.yml`; npm/Sigstore provenance binds the package to `refs/tags/v0.1.1`, source commit `fb404fcf1c9a2917bce7712aecb3b48f901413a1`, and workflow run `31935378467` attempt 2. Registry integrity/shasum match a fresh npm pack proof and a fresh registry consumer loads under exact OpenCode `1.18.18`. Canonical T4 evidence is `data/validation/release-publication-0.1.1.json` plus `data/validation/t4-registry-exact-host-0.1.1.json`.
