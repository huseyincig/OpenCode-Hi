import { HI_ROLE_CONTRACTS, HI_ROLE_IDS, HI_ROLE_PRIMARY_IDS, HI_ROLE_CHILD_IDS, HI_ROLE_READ_ONLY_CHILD_IDS, HI_ROLE_REVIEWER_IDS } from '../../generated/role-policy.js';
export const HI_ROLES = HI_ROLE_IDS;
export const HI_PRIMARY_ROLES = HI_ROLE_PRIMARY_IDS;
export const HI_CHILD_ROLES = HI_ROLE_CHILD_IDS;
export const HI_READ_ONLY_CHILD_ROLES = HI_ROLE_READ_ONLY_CHILD_IDS;
export const HI_REVIEWER_ROLES = HI_ROLE_REVIEWER_IDS;
const PRIMARY = new Set(HI_PRIMARY_ROLES);
const CHILD = new Set(HI_CHILD_ROLES);
const READ_ONLY = new Set(HI_READ_ONLY_CHILD_ROLES);
const REVIEWER = new Set(HI_REVIEWER_ROLES);
const BY_ID = new Map(HI_ROLE_CONTRACTS.map(role => [role.id, role]));
export function isHiPrimaryRole(value) { return typeof value === 'string' && PRIMARY.has(value); }
export function isHiChildRole(value) { return typeof value === 'string' && CHILD.has(value); }
export function isHiReadOnlyChildRole(value) { return typeof value === 'string' && READ_ONLY.has(value); }
export function isHiReviewerRole(value) { return typeof value === 'string' && REVIEWER.has(value); }
export function roleCanOwnObligation(role, kind) { const contract = BY_ID.get(role); return Boolean(contract && contract.roleClass === 'child' && contract.obligationAuthority.includes(kind)); }
export function primaryRoleCanDirectImplementation(role) { const contract = BY_ID.get(role); if (!contract || contract.roleClass !== 'primary')
    return false; const writeAuthority = contract.repositoryWriteAuthority; return !contract.readOnly && writeAuthority !== 'none'; }
