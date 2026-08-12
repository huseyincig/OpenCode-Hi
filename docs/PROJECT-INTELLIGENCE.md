# Project Intelligence

Project Intelligence stores bounded, repository-scoped, evidence-backed project patterns such as API conventions, testing style, error handling, module boundaries, and release conventions. Entries carry source files/hashes, confidence, lifecycle, freshness, and update time.

Lifecycle is `ACTIVE`, `SUPERSEDED`, or `ARCHIVED`. Freshness is `FRESH` or `POTENTIALLY_STALE`. A relevant source-surface change invalidates freshness; historical knowledge never overrides current repository evidence.
