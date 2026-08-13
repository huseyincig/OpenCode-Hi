export const HI_PRIMARY_ROLES = ['working-manager', 'manager'];
export const HI_CHILD_ROLES = ['coder', 'architect', 'repository-explorer', 'qa-reviewer', 'security-reviewer', 'visual-qa'];
export const HI_ROLES = [...HI_PRIMARY_ROLES, ...HI_CHILD_ROLES];
export const HI_READ_ONLY_CHILD_ROLES = ['architect', 'repository-explorer', 'qa-reviewer', 'security-reviewer', 'visual-qa'];
export const HI_REVIEWER_ROLES = ['qa-reviewer', 'security-reviewer', 'visual-qa'];
const PRIMARY = new Set(HI_PRIMARY_ROLES), CHILD = new Set(HI_CHILD_ROLES), READ_ONLY = new Set(HI_READ_ONLY_CHILD_ROLES), REVIEWER = new Set(HI_REVIEWER_ROLES);
const OBLIGATIONS = { coder: new Set(['implementation', 'analysis', 'verification']), architect: new Set(['analysis', 'verification']), 'repository-explorer': new Set(['analysis', 'verification']), 'qa-reviewer': new Set(['review', 'verification']), 'security-reviewer': new Set(['review', 'verification']), 'visual-qa': new Set(['review', 'verification']) };
export function isHiPrimaryRole(v) { return typeof v === 'string' && PRIMARY.has(v); }
export function isHiChildRole(v) { return typeof v === 'string' && CHILD.has(v); }
export function isHiReadOnlyChildRole(v) { return typeof v === 'string' && READ_ONLY.has(v); }
export function isHiReviewerRole(v) { return typeof v === 'string' && REVIEWER.has(v); }
export function roleCanOwnObligation(role, kind) { return isHiChildRole(role) && OBLIGATIONS[role].has(kind); }
