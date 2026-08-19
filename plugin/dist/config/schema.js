export const HI_CONFIG_SCHEMA = 2;
export const MODEL_ROUTED_CHILD_ROLES = ['coder', 'architect', 'repository-explorer', 'qa-reviewer', 'security-reviewer', 'visual-qa'];
export function isModelRoutedChildRole(value) { return typeof value === 'string' && MODEL_ROUTED_CHILD_ROLES.includes(value); }
export function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value); }
