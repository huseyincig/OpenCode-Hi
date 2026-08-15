import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isHumanDecisionContract } from '../dist/contracts/human-decision.js'
import { classifyRuntimeHumanDecision,openHumanDecision } from '../dist/runtime/human-decision/runtime.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { RuntimePersistence } from '../dist/runtime/state/persistence.js'
import { evaluateCompletion } from '../dist/runtime/completion/evaluator.js'
import { evaluateIdle } from '../dist/runtime/continuation/evaluator.js'
import { formatUserMissionStatus } from '../dist/runtime/ledger/status.js'
import { approvePendingAuthority,requireAuthority } from '../dist/runtime/safety/authority.js'
import {authorityProtocolResponse} from './helpers/authority.mjs'
import { startAssessedMission } from './helpers/semantic.mjs'

test('HumanDecisionContract is strict and duplicate open requests preserve one decision identity',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'human-contract','small task')
  const first=openHumanDecision(m,{semantic_type:'operational_action',reason_code:'provider-unavailable',summary:'Provider requires intervention',response_schema:{kind:'external-action'}})
  const count=m.execution.ledger.filter(e=>e.type==='user.action.required').length
  const second=openHumanDecision(m,{semantic_type:'operational_action',reason_code:'provider-unavailable',summary:'Provider still requires intervention',response_schema:{kind:'external-action'}})
  assert.equal(second.decision_id,first.decision_id);assert.equal(second.created_at,first.created_at);assert.equal(m.execution.ledger.filter(e=>e.type==='user.action.required').length,count)
  assert.equal(isHumanDecisionContract(second),true)
  assert.equal(isHumanDecisionContract({...second,unexpected:true}),false)
  assert.equal(isHumanDecisionContract({...second,decision_id:'hd_'+ 'f'.repeat(20)}),false)
  assert.equal(isHumanDecisionContract({...second,status:'RESOLVED'}),false)
})

test('open operational HumanDecision blocks deterministic completion and is visible in bounded user status',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'human-completion','small task')
  m.execution.obligations=[];m.execution.evidence.fresh=true
  openHumanDecision(m,{semantic_type:'operational_action',reason_code:'environment-action',summary:'External environment repair required',response_schema:{kind:'external-action'}})
  const c=evaluateCompletion(m);assert.equal(c.complete,false);assert.equal(c.next,'USER_ACTION_REQUIRED');assert.deepEqual(c.reasons,['human-decision:environment-action'])
  assert.match(formatUserMissionStatus(m),/human operational_action:environment-action/)
})

test('runtime HumanDecision classifier keeps rollback/provider/permission separate from exact authority',()=>{
  assert.equal(classifyRuntimeHumanDecision('waiting-user-authority').semantic_type,'operational_action')
  assert.equal(classifyRuntimeHumanDecision('rollback-user-action').semantic_type,'operational_action')
  assert.equal(classifyRuntimeHumanDecision('provider-failure-blocked').semantic_type,'operational_action')
  assert.equal(classifyRuntimeHumanDecision('permission-failure-blocked').semantic_type,'operational_action')
})

test('generic semantic follow-up resolves non-authority HumanDecision but never exact authority request',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'human-followup','small task')
  openHumanDecision(m,{semantic_type:'operational_action',reason_code:'provider-unavailable',summary:'Provider repair required',response_schema:{kind:'external-action'}})
  store.beginFollowupSemanticAssessment(m.identity.session_id,'I changed the provider configuration')
  assert.equal(m.authority.human_decision.status,'RESOLVED')

  const store2=new MissionStore(),a=startAssessedMission(store2,'human-authority-followup','release task')
  openHumanDecision(a,{semantic_type:'authority_request',reason_code:'authority-approval-required',summary:'Exact action approval required',response_schema:{kind:'authority-protocol',protocol:'approve-exact-action'},authority_ref:'abc'})
  store2.beginFollowupSemanticAssessment(a.identity.session_id,'continue')
  assert.equal(a.authority.human_decision.status,'OPEN')
})

test('exact authority approval resolves the matching HumanDecision without treating generic continuation as approval',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'human-authority','release task')
  assert.throws(()=>requireAuthority(m,'git push origin main',process.cwd()),/explicit approval required/)
  assert.equal(m.authority.human_decision.semantic_type,'authority_request');assert.equal(m.authority.human_decision.response_schema.protocol,'approve-exact-action');assert.equal(m.authority.human_decision.status,'OPEN')
  assert.equal(approvePendingAuthority(m,'continue'),false);assert.equal(m.authority.human_decision.status,'OPEN')
  assert.equal(approvePendingAuthority(m,authorityProtocolResponse(m,'approve')),true);assert.equal(m.authority.human_decision.status,'RESOLVED');assert.equal(m.authority.human_decision.resolution,'authority-approved')
})

test('RuntimePersistence round-trip preserves canonical HumanDecision state and rejects malformed decision',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-human-decision-'))
  try{
    const store=new MissionStore(root),m=startAssessedMission(store,'human-persist','small task')
    openHumanDecision(m,{semantic_type:'credential_action',reason_code:'interactive-shell',summary:'Interactive login required',response_schema:{kind:'external-action'}})
    new RuntimePersistence(root).save(store.all(),true)
    const loaded=new RuntimePersistence(root).load();assert.equal(loaded.length,1);assert.equal(loaded[0].authority.human_decision.decision_id,m.authority.human_decision.decision_id);assert.equal(loaded[0].authority.human_decision.status,'OPEN')
    const bad=structuredClone(m);bad.authority.human_decision={...bad.authority.human_decision,decision_id:'hd_'+ 'f'.repeat(20)}
    new RuntimePersistence(root).save([bad],true);const invalid=new RuntimePersistence(root);assert.deepEqual(invalid.load(),[]);assert.match(invalid.lastLoadReport.error,/invalid mission state/)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('temporary rollback USER_ACTION_REQUIRED is operational, not authority',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'human-rollback','small task')
  m.vcs.temporary_mutations.push({id:'tm1',kind:'test',description:'temporary',rollback_command:'echo rollback',rollback_hash:'x',status:'active',created_at:1})
  const decision=evaluateIdle(m);assert.equal(decision.decision,'USER_ACTION_REQUIRED');assert.equal(decision.reason_code,'precondition-blocked');assert.equal(classifyRuntimeHumanDecision(decision.reason_code).semantic_type,'operational_action')
})


test('PROMPT B authority HumanDecision requires exact authority semantics and non-authority decisions cannot impersonate Authority',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'human-coherence','small task')
  assert.throws(()=>openHumanDecision(m,{semantic_type:'authority_request',reason_code:'authority-generic',summary:'bad',response_schema:{kind:'authority-protocol',protocol:'approve-exact-action'}}),/semantically incoherent/)
  assert.throws(()=>openHumanDecision(m,{semantic_type:'authority_request',reason_code:'authority-generic',summary:'bad',response_schema:{kind:'external-action'},authority_ref:'abc'}),/semantically incoherent/)
  assert.throws(()=>openHumanDecision(m,{semantic_type:'operational_action',reason_code:'not-authority',summary:'bad',response_schema:{kind:'authority-protocol',protocol:'approve-exact-action'},authority_ref:'abc'}),/semantically incoherent/)
  assert.equal(m.authority.human_decision,undefined)
  assert.equal(classifyRuntimeHumanDecision('authority-looking-runtime-label').semantic_type,'operational_action')
})

test('PROMPT B HumanDecision identity and provenance bind exact blocked task/worker scope',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'human-scope','small task')
  const a=openHumanDecision(m,{semantic_type:'ambiguity',reason_code:'choose-contract',summary:'choose',task_id:'t_a',worker_id:'w_a',response_schema:{kind:'choice',choices:['one','two']}})
  assert.deepEqual(a.blocking_scope,{mission_id:m.identity.mission_id,task_id:'t_a',worker_id:'w_a'})
  const b=openHumanDecision(m,{semantic_type:'ambiguity',reason_code:'choose-contract',summary:'choose',task_id:'t_b',worker_id:'w_b',response_schema:{kind:'choice',choices:['one','two']}})
  assert.notEqual(b.decision_id,a.decision_id);assert.deepEqual(b.blocking_scope,{mission_id:m.identity.mission_id,task_id:'t_b',worker_id:'w_b'})
})

test('PROMPT B operational HumanDecision response never creates or approves Authority state',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'human-no-authority','small task')
  openHumanDecision(m,{semantic_type:'operational_action',reason_code:'repair-env',summary:'repair',response_schema:{kind:'external-action'}})
  assert.equal(m.authority.authority,undefined)
  store.beginFollowupSemanticAssessment(m.identity.session_id,'done')
  assert.equal(m.authority.human_decision.status,'RESOLVED');assert.equal(m.authority.authority,undefined)
})
