import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {validateMissionEnvelope} from '../dist/runtime/mission/validators.js'
import {addEvidence} from '../dist/runtime/evidence/evidence-runtime.js'
import {RuntimePersistence} from '../dist/runtime/state/persistence.js'

const ASSESS={material:true,message_kind:'mission',task_kind:'review',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['review','verification'],requested_external_actions:[],likely_verification:['review-evidence'],likely_targets:['src/a.ts'],intent_signals:[],suppressed_intent_signals:[]}

function mission(){
  const store=new MissionStore(),m=store.start('m19-durable-id','review src/a.ts')
  store.applyInitialSemanticAssessment('m19-durable-id',ASSESS)
  return m
}

function duplicateCases(){
  const obligation=mission();obligation.execution.obligations.push(structuredClone(obligation.execution.obligations[0]))
  const evidence=mission();addEvidence(evidence,{kind:'review-input',summary:'first',scope:['src/a.ts'],source:'m19-probe',outcome:'pending'});evidence.execution.evidence.items.push({...structuredClone(evidence.execution.evidence.items[0]),summary:'same durable id, different item'})
  const gate=mission();gate.execution.gates.push(structuredClone(gate.execution.gates[0]))
  const context=mission();context.context.context_artifacts.push({id:'ca_duplicate',kind:'research',summary:'first',added_at:Date.now()},{id:'ca_duplicate',kind:'research',summary:'second',added_at:Date.now()})
  const mutation=mission();const item={id:'tm_duplicate',kind:'experiment',description:'temporary',rollback_command:'git status',rollback_hash:'hash',status:'active',created_at:Date.now()};mutation.vcs.temporary_mutations.push(item,structuredClone(item))
  return[['obligation',obligation],['evidence',evidence],['gate',gate],['context-artifact',context],['temporary-mutation',mutation]]
}

test('rejects duplicate reference-consumed durable identities inside one Mission',()=>{
  for(const [kind,m] of duplicateCases())assert.equal(validateMissionEnvelope(m),false,`${kind} duplicate identity must fail closed`)
})

test('persistence refuses duplicate canonical evidence identity before replacing runtime state',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-m19-durable-id-'))
  try{
    const m=mission();addEvidence(m,{kind:'review-input',summary:'first',scope:['src/a.ts'],source:'m19-persistence',outcome:'pending'});m.execution.evidence.items.push({...structuredClone(m.execution.evidence.items[0]),summary:'ambiguous duplicate'})
    const persistence=new RuntimePersistence(root,join(root,'runtime-state.json'))
    assert.throws(()=>persistence.save([m]),/refusing to persist invalid mission state/i)
  }finally{rmSync(root,{recursive:true,force:true})}
})
