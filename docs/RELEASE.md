# Release Engineering

OpenCode-Hi preserves deterministic source/distributable artifacts, manifest, SBOM, hashes, clean-candidate validation, and forensic candidate binding from the proven baseline. Publishing is authority-gated and must not rely on long-lived secrets when trusted/OIDC publishing is available.

A 0.1.0 candidate may be called release-ready only when all mandatory internal gates are green and required external OpenCode/clean-install receipts are bound to the exact candidate. If the environment prevents an external receipt, status remains `PENDING_EXTERNAL`; the acceptance bar is not lowered.

## Current release status

The block below is generator-owned. Do not hand-edit current release status, current reference-host version, or test counts here.

<!-- BEGIN GENERATED RELEASE STATUS -->
## Current release status — generated

- Release: `0.1.0` — **PARTIAL_EXTERNAL_NPM_BOOTSTRAP_AUTH**.
- GitHub: **PASS_T4** for `v0.1.0` at exact source `f1a2c1c4358e5a63656da7a585b6b5793d1ed3be`; remote asset digests match: `true`.
- npm: **BLOCKED_T4_AUTH**; package is not yet present, no publish has been attempted, and Trusted Publisher binding remains unavailable until the package exists.
- Trusted Publishing: local workflow readiness is `LOCAL_IMPLEMENTED_EXTERNAL_BOOTSTRAP_REQUIRED`; bootstrap publication/auth + registry proof + trust binding remain external.
- Reference host: OpenCode `1.18.18` on `linux/aarch64`; process/workspace/browser owned surfaces are receipt-backed `SUPPORTED_T3`.
- Test counts are intentionally not persisted here. Run the canonical verification commands for fresh counts/results.
- Machine source: `data/validation/release-status-0.1.0.json` (generated from hash-bound receipts/status inputs).
<!-- END GENERATED RELEASE STATUS -->


## npm Trusted Publishing / OIDC boundary

R1 adds a dedicated `.github/workflows/npm-publish.yml` executor for future npm releases. It is intentionally not a second release-state owner: Hi's canonical release-chain remains responsible for fresh pack identity/integrity and registry equality, while the GitHub workflow supplies the external OIDC execution path. The workflow is restricted to a non-prerelease GitHub `release.published` event in `huseyincig/OpenCode-Hi`, uses a GitHub-hosted Ubuntu runner, grants only `contents: read` plus job-scoped `id-token: write`, carries no npm write token secret, requires Node/npm versions compatible with npm Trusted Publishing, checks out the exact release tag, and fails closed unless that tag is annotated, resolves to checked-out HEAD, and exactly matches `VERSION`, root/runtime/lock package versions, and the canonical repository URL. A fresh `npm pack --dry-run --json` proof is captured before `npm publish`; publication is not accepted until `npm view` returns the same version, integrity and shasum and a fresh consumer can install/import the registry package.

Current `v0.1.0` remains immutable at released source `f1a2c1c4358e5a63656da7a585b6b5793d1ed3be`. The OIDC workflow was added later and therefore cannot be represented as part of that historical tag. npm currently reports `ENEEDAUTH` and `opencode-hi@0.1.0` is absent. npm Trusted Publisher configuration itself requires an already-existing package, so the remaining external bootstrap is: obtain explicit npm registry authentication, publish the already-released exact `0.1.0` package artifact without changing/re-tagging its source identity, verify registry version/integrity/shasum and fresh installation, then bind the package's trusted publisher to GitHub repository `huseyincig/OpenCode-Hi`, workflow filename `npm-publish.yml`, allowed action `npm publish`. Subsequent release publications use OIDC and no long-lived npm write token. Until those account/registry actions occur, R1 is locally implemented but externally incomplete; no T4 npm claim is made.
