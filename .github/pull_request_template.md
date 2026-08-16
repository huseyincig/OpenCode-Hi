## What changed

<!-- Describe the user-visible or engineering change. -->

## Why

<!-- Link the issue or explain the problem. -->

## Verification

- [ ] Focused tests for the changed behavior
- [ ] `npm run check` when the change affects shipped/runtime behavior
- [ ] Python acceptance when the changed boundary is covered there
- [ ] Documentation updated when the public contract changed

## Safety

- [ ] No secrets or private runtime state committed
- [ ] Existing user files/configuration are preserved
- [ ] External effects remain explicit and authority-gated
