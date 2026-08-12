# Release Engineering

OpenCode-Hi preserves deterministic source/distributable artifacts, manifest, SBOM, hashes, clean-candidate validation, and forensic candidate binding from the proven baseline. Publishing is authority-gated and must not rely on long-lived secrets when trusted/OIDC publishing is available.

A 0.1.0 candidate may be called release-ready only when all mandatory internal gates are green and required external OpenCode/clean-install receipts are bound to the exact candidate. If the environment prevents an external receipt, status remains `PENDING_EXTERNAL`; the acceptance bar is not lowered.
