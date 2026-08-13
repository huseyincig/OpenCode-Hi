---
name: hi-release-guardrails
description: Verify release metadata, package integrity, evidence, and authority boundaries.
---

# Release Guardrails

## Contract

- **Trigger:** A release candidate, package, tag, publish, or distribution step is being prepared.
- **Do not trigger:** Ordinary development not approaching a release boundary.
- **Exit condition:** Candidate evidence is exact-bound and external publication remains explicitly authorized.
- **Role affinity:** working-manager
- **Context cost:** high
- **Execution cost:** high

## Method

1. Define the exact release candidate identity and verify source cleanliness, version/package metadata, required quality gates, and declared external pending gates.
2. Build distributable, source, and package artifacts deterministically and compare manifest, SBOM, hashes, package surface, dependency/install behavior, and source identity.
3. Keep publish, tag, and push authority separate from preparation; before any authorized external mutation, prove the artifact being acted on is the verified candidate.
4. After an authorized external action, verify the remote or registry state independently and stop only when local claims and observed external state agree.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
