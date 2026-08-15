import {HI_ROLE_CONTRACTS,HI_ROLE_IDS,HI_ROLE_PRIMARY_IDS,HI_ROLE_CHILD_IDS,HI_ROLE_READ_ONLY_CHILD_IDS,HI_ROLE_REVIEWER_IDS,type HiRole,type HiPrimaryRole,type HiChildRole} from '../../generated/role-policy.js'

export const HI_ROLES=HI_ROLE_IDS
export const HI_PRIMARY_ROLES=HI_ROLE_PRIMARY_IDS
export const HI_CHILD_ROLES=HI_ROLE_CHILD_IDS
export const HI_READ_ONLY_CHILD_ROLES=HI_ROLE_READ_ONLY_CHILD_IDS
export const HI_REVIEWER_ROLES=HI_ROLE_REVIEWER_IDS
export type {HiRole,HiPrimaryRole,HiChildRole}

const PRIMARY=new Set<string>(HI_PRIMARY_ROLES)
const CHILD=new Set<string>(HI_CHILD_ROLES)
const READ_ONLY=new Set<string>(HI_READ_ONLY_CHILD_ROLES)
const REVIEWER=new Set<string>(HI_REVIEWER_ROLES)
const BY_ID=new Map(HI_ROLE_CONTRACTS.map(role=>[role.id,role] as const))

export function isHiPrimaryRole(value:unknown):value is HiPrimaryRole{return typeof value==='string'&&PRIMARY.has(value)}
export function isHiChildRole(value:unknown):value is HiChildRole{return typeof value==='string'&&CHILD.has(value)}
export function isHiReadOnlyChildRole(value:unknown):boolean{return typeof value==='string'&&READ_ONLY.has(value)}
export function isHiReviewerRole(value:unknown):boolean{return typeof value==='string'&&REVIEWER.has(value)}
export function roleCanOwnObligation(role:string,kind:string):boolean{const contract=BY_ID.get(role as HiRole);return Boolean(contract&&contract.roleClass==='child'&&(contract.obligationAuthority as readonly string[]).includes(kind))}
export function primaryRoleCanDirectImplementation(role:string):boolean{const contract=BY_ID.get(role as HiRole);if(!contract||contract.roleClass!=='primary')return false;const writeAuthority:string=contract.repositoryWriteAuthority;return !contract.readOnly&&writeAuthority!=='none'}
