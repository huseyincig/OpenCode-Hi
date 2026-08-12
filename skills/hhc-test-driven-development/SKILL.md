---
name: hhc-test-driven-development
description: Use when a behavior change or bug fix benefits from proving the failure before implementation and preserving it as a regression test.
---

# Test-Driven Development

Use a bounded RED → GREEN → REFACTOR loop when test-first work is valuable.

## Method
1. RED: create or identify the smallest test that demonstrates the missing/incorrect behavior and confirm it fails for the expected reason.
2. GREEN: make the minimum safe implementation change that makes that test pass.
3. REFACTOR: improve structure only while the covering test remains green.
4. Re-run the smallest relevant regression surface after the final edit.

For bug fixes, prefer a reproducing regression test before changing implementation. Do not manufacture brittle tests for documentation, pure configuration, or behavior that cannot be deterministically tested. TDD methodology does not replace HHC evidence freshness or completion adjudication.
