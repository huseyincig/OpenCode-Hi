import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {parseSemanticIntentAssessment} from '../dist/runtime/intent/semantic-assessment.js'
import {createToolBeforeHook} from '../dist/hooks/tool-before.js'

const cleanNonMaterial={
  material:false,
  message_kind:'non-material',
  task_kind:'review',
  scope:'local',
  risk:'low',
  ambiguity:'none',
  dependency_class:'independent',
  required_capabilities:[],
  requested_external_actions:[],
  likely_verification:[],
  user_verification:[],
  verification_ceiling:false,
  likely_targets:[],
  intent_signals:[],
  suppressed_intent_signals:[],
}

test('initial non-material assessment rejects its own material execution indicators',()=>{
  for(const [field,value] of [
    ['required_capabilities',['verification']],
    ['requested_external_actions',['git-push']],
    ['likely_verification',['review-evidence']],
    ['likely_targets',['src/a.ts']],
  ]){
    const store=new MissionStore(process.cwd()),m=store.start(`nonmaterial-${field}`,'bounded input')
    const assessment=parseSemanticIntentAssessment({...cleanNonMaterial,[field]:value,risk:field==='requested_external_actions'?'authority-boundary':'low'})
    assert.throws(()=>store.applyInitialSemanticAssessment(m.identity.session_id,assessment),/non-material.*material execution/i,field)
    assert.equal(m.identity.semantic_assessment.status,'pending',`${field} rejection must preserve assessment ownership`)
  }
})

test('clean non-material assessment remains terminal when no work tool is attempted',()=>{
  const store=new MissionStore(process.cwd()),m=store.start('nonmaterial-clean','hello there')
  store.applyInitialSemanticAssessment(m.identity.session_id,parseSemanticIntentAssessment(cleanNonMaterial))
  assert.equal(m.identity.status,'completed')
  assert.deepEqual(m.execution.obligations,[])
  assert.ok(m.execution.ledger.some(e=>e.type==='semantic.non-material'))
})

test('work tool after non-material conclusion is blocked before execution and reopens initial semantic assessment exactly once',async()=>{
  const store=new MissionStore(process.cwd()),m=store.start('nonmaterial-read','Review note.txt')
  store.applyInitialSemanticAssessment(m.identity.session_id,parseSemanticIntentAssessment(cleanNonMaterial))
  const before=createToolBeforeHook(store,undefined,process.cwd())
  await assert.rejects(()=>before({sessionID:m.identity.session_id,tool:'read',args:{filePath:'note.txt'}},{args:{filePath:'note.txt'}}),/non-material.*contradicted.*semantic assessment/i)
  assert.equal(m.identity.status,'active')
  assert.equal(m.identity.semantic_assessment.status,'pending')
  assert.equal(m.identity.semantic_assessment.phase,'initial')
  assert.equal(m.identity.semantic_assessment.revision,2)
  assert.ok(m.execution.ledger.some(e=>e.type==='semantic.non-material-contradicted'&&e.payload?.tool==='read'))
  await assert.rejects(()=>before({sessionID:m.identity.session_id,tool:'read',args:{filePath:'note.txt'}},{args:{filePath:'note.txt'}}),/semantic gate/i)
  assert.equal(m.identity.semantic_assessment.revision,2,'repeated blocked tool must not create revision churn')
})

test('non-material conclusion permits only control inspection and reassessment surfaces',async()=>{
  const store=new MissionStore(process.cwd()),m=store.start('nonmaterial-control','thanks')
  store.applyInitialSemanticAssessment(m.identity.session_id,parseSemanticIntentAssessment(cleanNonMaterial))
  const before=createToolBeforeHook(store,undefined,process.cwd())
  for(const tool of ['hi_status','hi_ledger','hi_readiness','hi_role_models','hi_intent_assess'])await before({sessionID:m.identity.session_id,tool},{args:{}})
  assert.equal(m.identity.status,'completed')
  assert.equal(m.identity.semantic_assessment.revision,1)
})

test('corrected material reassessment after contradiction restores review and verification obligations',async()=>{
  const store=new MissionStore(process.cwd()),m=store.start('nonmaterial-correct','Review note.txt')
  store.applyInitialSemanticAssessment(m.identity.session_id,parseSemanticIntentAssessment(cleanNonMaterial))
  const before=createToolBeforeHook(store,undefined,process.cwd())
  await assert.rejects(()=>before({sessionID:m.identity.session_id,tool:'read',args:{filePath:'note.txt'}},{args:{filePath:'note.txt'}}))
  store.applyInitialSemanticAssessment(m.identity.session_id,parseSemanticIntentAssessment({...cleanNonMaterial,material:true,message_kind:'mission',required_capabilities:['review','verification'],likely_verification:['review-evidence'],likely_targets:['note.txt']}))
  assert.equal(m.identity.status,'active')
  assert.ok(m.execution.obligations.some(o=>o.kind==='review'&&o.status==='open'))
  assert.ok(m.execution.obligations.some(o=>o.kind==='verification'&&o.status==='open'))
  await before({sessionID:m.identity.session_id,tool:'read',args:{filePath:'note.txt'}},{args:{filePath:'note.txt'}})
})
