import type { VerificationCase } from '../../contracts/verification-case.js'
import type { SemanticCapability,SemanticIntentAssessment } from './semantic-assessment.js'

export interface SemanticRequestUnit { id:string; text:string }
const LIST_ITEM=/^(?:[-*+]\s+|\d+[.)]\s+)/
const HEADING=/^#{1,6}\s+/
const CLAUSE_SPLIT=/(?:[.!?;]+(?:\s+|$)|:\s+|,\s+|\s+\+\s+)/u

export function semanticRequestUnits(text:string,limit=24):SemanticRequestUnit[]{
  const lines=String(text??'').replace(/\r\n?/g,'\n').split('\n'),units:string[]=[],paragraph:string[]=[]
  const pushClauses=(value:string)=>{for(const part of value.split(CLAUSE_SPLIT)){const clean=part.replace(/\s+/g,' ').trim();if(clean&&units.length<limit)units.push(clean.slice(0,500))}}
  const flush=()=>{if(paragraph.length){pushClauses(paragraph.join(' '));paragraph.length=0}}
  const nextNonEmpty=(start:number)=>{for(let i=start;i<lines.length;i++){const v=lines[i]!.trim();if(v)return v}return''}
  for(let i=0;i<lines.length&&units.length<limit;i++){
    const trimmed=lines[i]!.trim();if(!trimmed){flush();continue}
    if(HEADING.test(trimmed)){flush();continue}
    if(LIST_ITEM.test(trimmed)){flush();pushClauses(trimmed.replace(LIST_ITEM,''));continue}
    const next=nextNonEmpty(i+1);if(trimmed.endsWith(':')&&LIST_ITEM.test(next)){flush();continue}
    paragraph.push(trimmed)
  }
  flush()
  return units.map((unit,index)=>({id:`ru${index+1}`,text:unit}))
}

function requestUnitMap(text:string):Map<string,SemanticRequestUnit>{return new Map(semanticRequestUnits(text).map(unit=>[unit.id,unit]))}
export function renderRequestUnitChallenge(text:string):string{const units=semanticRequestUnits(text);return`request_units=${units.map(unit=>`${unit.id}:${JSON.stringify(unit.text)}`).join('|')}`.slice(0,6000)}

export function assertVerificationRequestTrace(text:string,assessment:SemanticIntentAssessment):void{
  const visual=assessment.likely_verification.includes('visual-check'),nonvisual=assessment.nonvisual_request_units??[]
  if(!visual){if(nonvisual.length)throw new Error('nonvisual_request_units are only used to partition visual-check request traces; when visual-check is absent set nonvisual_request_units=[]');return}
  if(['resume','constraint'].includes(assessment.message_kind)&&assessment.verification_cases.length===0&&nonvisual.length===0)return
  const unitMap=requestUnitMap(text),all=[...unitMap.keys()],challenge=()=>renderRequestUnitChallenge(text);if(!all.length)throw new Error('visual-check request trace requires at least one deterministic request unit')
  const nonvisualSet=new Set(nonvisual);if(nonvisualSet.size!==nonvisual.length)throw new Error(`nonvisual_request_units must not contain duplicates; ${challenge()}`)
  const unknownNonvisual=nonvisual.filter(id=>!unitMap.has(id));if(unknownNonvisual.length)throw new Error(`nonvisual_request_units contain unknown id(s): ${unknownNonvisual.join(',')}; ${challenge()}`)
  const visualRefs=new Set<string>(),visualCapabilityRefs=new Set(assessment.capability_request_units?.['visual-qa']??[]),enforceVisualCapabilityTrace=assessment.scope==='multi-stream'&&visualCapabilityRefs.size>0
  for(const c of assessment.verification_cases){const refs=c.source_units??[];if(!refs.length)throw new Error(`verification case ${c.id} requires source_units; ${challenge()}`);for(const id of refs){if(!unitMap.has(id))throw new Error(`verification case ${c.id} source_units contains unknown id ${id}; ${challenge()}`);if(enforceVisualCapabilityTrace&&!visualCapabilityRefs.has(id))throw new Error(`verification case ${c.id} source_units contains non-visual request unit ${id}; verification_cases may only reference request units mapped to capability_request_units.visual-qa in multi-stream assessments; ${challenge()}`);visualRefs.add(id)}}
  const overlap=[...visualRefs].filter(id=>nonvisualSet.has(id));if(overlap.length)throw new Error(`request unit(s) cannot be both visual and nonvisual: ${overlap.join(',')}; ${challenge()}`)
  const missing=all.filter(id=>!visualRefs.has(id)&&!nonvisualSet.has(id));if(missing.length)throw new Error(`request trace incomplete; unclassified unit(s): ${missing.join(',')}; ${challenge()}`)
  if(!visualRefs.size)throw new Error(`visual-check requires at least one request unit mapped to verification_cases; ${challenge()}`)
}


export function assertCapabilityRequestTrace(text:string,assessment:SemanticIntentAssessment):void{
  const mapping=assessment.capability_request_units??{},entries=Object.entries(mapping) as [SemanticCapability,string[]][]
  const units=semanticRequestUnits(text),unitMap=new Map(units.map(unit=>[unit.id,unit])),challenge=()=>renderRequestUnitChallenge(text)
  for(const [cap,ids] of entries){for(const id of ids){if(!unitMap.has(id))throw new Error(`capability_request_units.${cap} contains unknown id ${id}; ${challenge()}`)}}
  const exhaustive=assessment.material&&assessment.message_kind==='mission'&&assessment.scope==='multi-stream'&&units.length>1
  if(!exhaustive)return
  if(!entries.length)throw new Error(`multi-stream semantic contract requires capability_request_units; ${challenge()}`)
  const covered=new Set(entries.flatMap(([,ids])=>ids)),missing=units.map(unit=>unit.id).filter(id=>!covered.has(id))
  if(missing.length)throw new Error(`capability request trace incomplete; unclassified unit(s): ${missing.join(',')}; ${challenge()}`)
}

export function cloneVerificationCases(cases:VerificationCase[]):VerificationCase[]{return cases.map(c=>({...c,required_browser_actions:[...c.required_browser_actions],...(c.source_units?.length?{source_units:[...c.source_units]}:{})}))}
