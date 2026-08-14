export type VerificationCheckResult='passed'|'failed'|'pending'|'environment-issue'|'not_run'
export type VerificationFreshness='fresh'|'stale'
export interface VerificationCheck { kind:string; subject:string; result:VerificationCheckResult; evidence_refs:string[]; explanation?:string }
export interface VerificationEnvelope { checks:VerificationCheck[]; scope:string[]; freshness:VerificationFreshness; limitations:string[]; independent_review:boolean }

const RESULT=new Set(['passed','failed','pending','environment-issue','not_run'])
const CHECK_KEYS=new Set(['kind','subject','result','evidence_refs','explanation'])
const ENVELOPE_KEYS=new Set(['checks','scope','freshness','limitations','independent_review'])
function record(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function strings(v:unknown):v is string[]{return Array.isArray(v)&&v.every(x=>typeof x==='string')}
function validCheck(v:unknown):v is VerificationCheck{if(!record(v)||!Object.keys(v).every(k=>CHECK_KEYS.has(k))||typeof v.kind!=='string'||!v.kind||typeof v.subject!=='string'||!v.subject||typeof v.result!=='string'||!RESULT.has(v.result)||!strings(v.evidence_refs))return false;if(v.explanation!==undefined&&typeof v.explanation!=='string')return false;if(v.result==='not_run'&&!v.explanation)return false;if(v.result==='passed'&&v.evidence_refs.length===0)return false;return true}
export function isVerificationEnvelopeContract(v:unknown):v is VerificationEnvelope{return record(v)&&Object.keys(v).every(k=>ENVELOPE_KEYS.has(k))&&Array.isArray(v.checks)&&v.checks.every(validCheck)&&strings(v.scope)&&['fresh','stale'].includes(String(v.freshness))&&strings(v.limitations)&&typeof v.independent_review==='boolean'}
