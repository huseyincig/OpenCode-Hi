---
name: hhc-source-driven-development
description: Use when implementation correctness depends on a framework, library, runtime, protocol, or tool version whose current official behavior must be verified.
---

# Source-Driven Development

Ground version-sensitive engineering decisions in authoritative sources instead of memory. Detect the exact stack/version from project files, retrieve only the relevant official reference/changelog/spec, and implement against that contract.

## Method
1. Identify the exact dependency/runtime version from repo evidence.
2. Prefer official documentation, specifications, release notes, or upstream source over tutorials and secondary commentary.
3. Extract only the API/behavior needed for the task, including deprecations and migration constraints.
4. Reconcile official guidance with existing project conventions; do not silently modernize unrelated code.
5. Mark any behavior not covered by authoritative evidence as unverified and choose a safe bounded default when possible.
6. Keep citations/links in the worker result when source verification materially affected the implementation.

Do not use for version-independent mechanical changes. Do not expand browsing/context beyond the smallest relevant source surface.
