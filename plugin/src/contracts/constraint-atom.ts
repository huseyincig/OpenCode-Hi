import { createHash } from 'node:crypto'

export const CONSTRAINT_SUBJECT_KINDS=['path','capability','methodology','decision','generic'] as const
export type ConstraintSubjectKind=typeof CONSTRAINT_SUBJECT_KINDS[number]
export const CONSTRAINT_PREDICATES=['mutate','read','use','require','preserve','verify'] as const
export type ConstraintPredicate=typeof CONSTRAINT_PREDICATES[number]
export const CONSTRAINT_POLARITIES=['ALLOW','DENY','REQUIRE'] as const
export type ConstraintPolarity=typeof CONSTRAINT_POLARITIES[number]
export type ConstraintAtomStatus='ACTIVE'|'SUPERSEDED'|'CONFLICTING'
export interface ConstraintAtomDraft{subject_kind:ConstraintSubjectKind;subject:string;predicate:ConstraintPredicate;polarity:ConstraintPolarity;scope:'mission'|'task';supersedes:string[]}
export interface ConstraintAtom extends ConstraintAtomDraft{id:string;authority:'USER';introduced_revision:number;status:ConstraintAtomStatus;source_text:string;created_at:number;superseded_by?:string}

function rec(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function strings(v:unknown):v is string[]{return Array.isArray(v)&&v.every(x=>typeof x==='string')}
function safeSubject(v:string,kind:ConstraintSubjectKind):boolean{
  const s=v.trim().replace(/\\/g,'/');if(!s||s.length>500||s.includes('\0'))return false
  if(kind!=='path')return true
  if(s.startsWith('/')||/^[A-Za-z]:\//.test(s)||s.split('/').some(x=>x==='..'))return false
  return true
}
export function isConstraintAtomDraft(v:unknown):v is ConstraintAtomDraft{
  if(!rec(v))return false
  const keys=Object.keys(v).sort().join(',');if(keys!=='polarity,predicate,scope,subject,subject_kind,supersedes')return false
  return typeof v.subject_kind==='string'&&(CONSTRAINT_SUBJECT_KINDS as readonly string[]).includes(v.subject_kind)&&typeof v.subject==='string'&&safeSubject(v.subject,v.subject_kind as ConstraintSubjectKind)&&typeof v.predicate==='string'&&(CONSTRAINT_PREDICATES as readonly string[]).includes(v.predicate)&&typeof v.polarity==='string'&&(CONSTRAINT_POLARITIES as readonly string[]).includes(v.polarity)&&['mission','task'].includes(String(v.scope))&&strings(v.supersedes)&&v.supersedes.every(x=>/^ca_[a-f0-9]{20}$/.test(x))
}
export function isConstraintAtom(v:unknown):v is ConstraintAtom{
  if(!rec(v)||!isConstraintAtomDraft({subject_kind:v.subject_kind,subject:v.subject,predicate:v.predicate,polarity:v.polarity,scope:v.scope,supersedes:v.supersedes}))return false
  if(typeof v.id!=='string'||!/^ca_[a-f0-9]{20}$/.test(v.id)||v.authority!=='USER'||!Number.isInteger(v.introduced_revision)||Number(v.introduced_revision)<1||!['ACTIVE','SUPERSEDED','CONFLICTING'].includes(String(v.status))||typeof v.source_text!=='string'||typeof v.created_at!=='number')return false
  return v.superseded_by===undefined||typeof v.superseded_by==='string'&&/^ca_[a-f0-9]{20}$/.test(v.superseded_by)
}
export function constraintAtomID(draft:ConstraintAtomDraft,revision:number):string{const normalized=[draft.subject_kind,draft.subject.trim().replace(/\\/g,'/'),draft.predicate,draft.polarity,draft.scope,String(revision)].join('\0');return`ca_${createHash('sha256').update(normalized).digest('hex').slice(0,20)}`}
