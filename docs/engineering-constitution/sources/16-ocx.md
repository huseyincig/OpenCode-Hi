# OCX

Status: VERIFIED STUDY PASS 1

## Identity

- Canonical repository: `kdcokenny/ocx`
- Reference action: ADAPT

## Source surfaces inspected

- `packages/cli/src/schemas/config.ts`
- repository root/package architecture inventory.

## Verified source facts

- User config and installed-component receipt are separate schemas.
- Installed components carry canonical ID, resolved revision, aggregate hash, per-file SHA-256 hashes, installation timestamps and ownership metadata.
- Receipt is explicitly versioned and records install-root context.
- Legacy lock schema is kept separately from current receipt semantics.

## Useful engineering patterns

- Installation/projection provenance should bind source revision + file hashes + owner.
- Canonical identity and integrity hash are separate concepts.
- Derived install receipts should be mechanically comparable to installed files.

## Foreign / accidental semantics to reject

- Hi current-only policy should not copy OCX legacy compatibility architecture unless explicitly required.
- Registry/profile product ontology is not Hi ontology.

## Hi mapping

- Strong input for ProvenanceRecord, HostProjectionReceipt and generated-artifact integrity validation.
- Project methodology admission already uses provenance/hash binding and should converge on the common provenance contract.
