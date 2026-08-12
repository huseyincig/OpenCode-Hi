---
name: hhc-iterative-retrieval
description: Use when the relevant repository context is not known up front and a worker should discover evidence incrementally instead of receiving or reading the whole codebase.
---

# Iterative Retrieval

Grow context only when the current evidence creates a concrete information need.

## Method
1. Start from the task contract, likely paths/symbols, and smallest repo evidence surface.
2. Form one retrieval question at a time: call sites, type definition, test coverage, config source, ownership boundary, etc.
3. Read/search only enough to answer that question.
4. Summarize the finding into compact facts/paths before retrieving more.
5. Stop expanding context once the task can be executed or the blocker is precisely identified.

Avoid repository-wide dumps, repeated reads of unchanged files, and forwarding raw search trajectories to the parent. Prefer symbol/path-specific native search and bounded handoff artifacts.
