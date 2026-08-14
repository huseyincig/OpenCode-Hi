import { createHash } from 'node:crypto'

export const SEMANTIC_CONTEXT_SYMBOL_KINDS=['interface','type','class','function','enum'] as const
export type SemanticContextSymbolKind=typeof SEMANTIC_CONTEXT_SYMBOL_KINDS[number]
export interface SemanticContextSymbol { kind:SemanticContextSymbolKind; name:string; signature:string; start:number; end:number }
export interface SemanticContextRelationship { kind:string; source_symbol:string; target_symbol:string }
export interface SemanticContextRange { start:number; end:number }
export interface SemanticContextBudget { max_chars:number; used_chars:number }
export interface SemanticContextContract {
  id:string
  source_ref:string
  source_hash:string
  language_adapter:'typescript'
  symbols:SemanticContextSymbol[]
  relationships:SemanticContextRelationship[]
  selected_ranges:SemanticContextRange[]
  consumer_task_ref:string
  budget:SemanticContextBudget
  created_at:number
  text:string
}

const KEYS=new Set(['id','source_ref','source_hash','language_adapter','symbols','relationships','selected_ranges','consumer_task_ref','budget','created_at','text'])
const SYMBOL_KEYS=new Set(['kind','name','signature','start','end'])
const REL_KEYS=new Set(['kind','source_symbol','target_symbol'])
const RANGE_KEYS=new Set(['start','end'])
const BUDGET_KEYS=new Set(['max_chars','used_chars'])
const KINDS=new Set<string>(SEMANTIC_CONTEXT_SYMBOL_KINDS)
function record(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function finite(v:unknown):v is number{return typeof v==='number'&&Number.isFinite(v)}
function validRange(v:unknown):boolean{return record(v)&&Object.keys(v).every(k=>RANGE_KEYS.has(k))&&finite(v.start)&&finite(v.end)&&(v.start as number)>=0&&(v.end as number)>(v.start as number)}
function validSymbol(v:unknown):boolean{return record(v)&&Object.keys(v).every(k=>SYMBOL_KEYS.has(k))&&typeof v.kind==='string'&&KINDS.has(v.kind)&&typeof v.name==='string'&&Boolean(v.name)&&typeof v.signature==='string'&&Boolean(v.signature)&&finite(v.start)&&finite(v.end)&&(v.start as number)>=0&&(v.end as number)>(v.start as number)}
function validRelationship(v:unknown):boolean{return record(v)&&Object.keys(v).every(k=>REL_KEYS.has(k))&&typeof v.kind==='string'&&Boolean(v.kind)&&typeof v.source_symbol==='string'&&Boolean(v.source_symbol)&&typeof v.target_symbol==='string'&&Boolean(v.target_symbol)}
export function semanticContextId(input:{consumer_task_ref:string;source_ref:string;source_hash:string;selected_ranges:SemanticContextRange[]}):string{
  const ranges=input.selected_ranges.map(r=>`${r.start}:${r.end}`).join(',')
  return`sc_${createHash('sha256').update(`${input.consumer_task_ref}\0${input.source_ref}\0${input.source_hash}\0${ranges}`).digest('hex').slice(0,20)}`
}
export function isSemanticContextContract(v:unknown):v is SemanticContextContract{
  if(!record(v)||!Object.keys(v).every(k=>KEYS.has(k))||typeof v.id!=='string'||!/^sc_[a-f0-9]{20}$/.test(v.id)||typeof v.source_ref!=='string'||!v.source_ref.startsWith('file:')||v.source_ref.includes('\\')||v.source_ref.split('/').includes('..')||v.source_ref.slice(5).startsWith('/')||!v.source_ref.slice(5)||typeof v.source_hash!=='string'||!/^[a-f0-9]{64}$/.test(v.source_hash)||v.language_adapter!=='typescript'||!Array.isArray(v.symbols)||!v.symbols.every(validSymbol)||!Array.isArray(v.relationships)||!v.relationships.every(validRelationship)||!Array.isArray(v.selected_ranges)||!v.selected_ranges.every(validRange)||typeof v.consumer_task_ref!=='string'||!v.consumer_task_ref||!record(v.budget)||!Object.keys(v.budget).every(k=>BUDGET_KEYS.has(k))||!finite(v.budget.max_chars)||!finite(v.budget.used_chars)||(v.budget.max_chars as number)<0||(v.budget.used_chars as number)<0||(v.budget.used_chars as number)>(v.budget.max_chars as number)||!finite(v.created_at)||(v.created_at as number)<=0||typeof v.text!=='string')return false
  const ranges=v.selected_ranges as SemanticContextRange[]
  if(v.symbols.length!==ranges.length||v.symbols.some((s,i)=>s.start!==ranges[i]?.start||s.end!==ranges[i]?.end))return false
  if(v.id!==semanticContextId({consumer_task_ref:v.consumer_task_ref as string,source_ref:v.source_ref as string,source_hash:v.source_hash as string,selected_ranges:ranges}))return false
  if(v.text.length!==v.budget.used_chars)return false
  const names=new Set(v.symbols.map(s=>s.name));if(v.relationships.some(r=>!names.has(r.source_symbol)||!names.has(r.target_symbol)))return false
  return true
}
