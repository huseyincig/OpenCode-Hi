export const HI_PRIMARY_ROLES=['working-manager','manager'] as const
export const HI_CHILD_ROLES=['coder','architect','repository-explorer','qa-reviewer','security-reviewer','visual-qa'] as const
export const HI_ROLES=[...HI_PRIMARY_ROLES,...HI_CHILD_ROLES] as const
export const HI_READ_ONLY_CHILD_ROLES=['architect','repository-explorer','qa-reviewer','security-reviewer','visual-qa'] as const
export const HI_REVIEWER_ROLES=['qa-reviewer','security-reviewer','visual-qa'] as const
export type HiPrimaryRole=typeof HI_PRIMARY_ROLES[number]
export type HiChildRole=typeof HI_CHILD_ROLES[number]
export type HiRole=typeof HI_ROLES[number]
const PRIMARY=new Set<string>(HI_PRIMARY_ROLES),CHILD=new Set<string>(HI_CHILD_ROLES),READ_ONLY=new Set<string>(HI_READ_ONLY_CHILD_ROLES),REVIEWER=new Set<string>(HI_REVIEWER_ROLES)
const OBLIGATIONS:Readonly<Record<HiChildRole,ReadonlySet<string>>>={coder:new Set(['implementation','analysis','verification']),architect:new Set(['analysis','verification']),'repository-explorer':new Set(['analysis','verification']),'qa-reviewer':new Set(['review','verification']),'security-reviewer':new Set(['review','verification']),'visual-qa':new Set(['review','verification'])}
export function isHiPrimaryRole(v:unknown):v is HiPrimaryRole{return typeof v==='string'&&PRIMARY.has(v)}
export function isHiChildRole(v:unknown):v is HiChildRole{return typeof v==='string'&&CHILD.has(v)}
export function isHiReadOnlyChildRole(v:unknown):boolean{return typeof v==='string'&&READ_ONLY.has(v)}
export function isHiReviewerRole(v:unknown):boolean{return typeof v==='string'&&REVIEWER.has(v)}
export function roleCanOwnObligation(role:string,kind:string):boolean{return isHiChildRole(role)&&OBLIGATIONS[role].has(kind)}
