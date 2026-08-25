---
name: hi-changelog-and-documentation
description: Update user-facing documentation for observable behavior changes.
---

# Changelog and Documentation

## Contract

- **Trigger:** A verified change affects users, installation, configuration, API, security, or supported behavior, or documentation/changelog alignment is explicitly requested.
- **Do not trigger:** Internal refactor/cosmetic rename with no user-visible effect.
- **Exit condition:** Canonical English documentation matches implemented behavior and translation does not add behavior.
- **Role affinity:** technical-writer
- **Context cost:** medium
- **Execution cost:** low

## Method

1. Derive documentation impact from the verified changed surface: user-visible behavior, installation, configuration, API/contract, security, support boundary, or release-facing change.
2. Identify the smallest canonical documentation set that owns that behavior; update English source-of-truth first and keep translations behavior-equivalent rather than additive.
3. Reconcile examples, commands, defaults, version references, configuration names, and changelog/release notes against executable behavior instead of copying implementation details blindly.
4. Re-read the changed docs as a user contract and stop only when no documented claim contradicts the verified product behavior.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
