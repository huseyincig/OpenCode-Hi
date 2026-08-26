import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs'
import {dirname,join} from 'node:path'
import {tmpdir} from 'node:os'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {deriveMissionModelFeedback} from '../dist/runtime/routing/model-feedback.js'
import {resolveModel} from '../dist/runtime/routing/model-resolver.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {ProjectMethodologyLearningStore} from '../dist/runtime/project-intelligence/methodology-learning.js'
import {methodologyCandidateAssessment,methodologyCandidateDigest,methodologyCandidateID} from '../dist/runtime/project-intelligence/methodology-candidate.js'
import {projectMethodologyCandidatePath} from '../dist/runtime/storage/ownership.js'
import {applyStructuredFollowup,startAssessedMission} from './helpers/semantic.mjs'

const inventory=[{id:'p/a',provider:'p',quality:5,cost:.2,expectedTurns:3,contextOverhead:1,tags:['balanced']},{id:'p/b',provider:'p',quality:5,cost:.2,expectedTurns:3,contextOverhead:1,tags:['balanced']}]
const cfg=resolveHiConfig({routing:{strategy:'cost-quality',roleModels:{coder:['p/a','p/b']},categoryModels:{}}})
function mission(id='m14-feedback'){const store=new MissionStore(process.cwd()),m=startAssessedMission(store,id,'bounded implementation',{task_kind:'implementation',required_capabilities:['implementation']});return{store,m}}
function addFailure(m,id,generation=m.continuation.generation,completed=Date.now()){
  const taskId=`t-${id}`
  m.execution.tasks.push({id:taskId,mission_id:m.identity.mission_id,objective:id,status:'failed',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],external_action_requirements:[],worker_id:id,created_at:completed-100,updated_at:completed,result:{status:'FAILED',summary:id,changed_files:[],evidence:[{kind:'targeted-tests',summary:'failed',pass:false,outcome:'failed'}],open_issues:[],needs_context:[]}})
  m.execution.workers.push({id,task_id:taskId,role:'coder',category:'standard',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,model:'p/a',fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:`f-${id}`,status:'failed',attempt:1,generation_at_spawn:generation,started_at:completed-100,updated_at:completed,completed_at:completed})
  m.execution.evidence.items.push({id:`ev-${id}`,kind:'targeted-tests',summary:'canonical failed proof',scope:[],source:`worker:${id}`,source_session_id:`s-${id}`,source_state_hash:'a'.repeat(64),task_id:taskId,obligation_ids:[],producer_attempt:{worker_id:id,execution_unit_id:`eu:${taskId}`,attempt_id:`eu:${taskId}:g${generation}:a1`,run_id:`worker:${id}:g${generation}:a1`,ordinal:1,generation},observed_at:completed,pass:false,outcome:'failed'})
}
function route(m,explicit){const feedback=deriveMissionModelFeedback(m,'coder','standard');return{feedback,resolution:resolveModel('standard',inventory,cfg,explicit,'coder',undefined,feedback)}}

test('M14 model feedback survives control-only verification follow-up but decays across material amendment',()=>{
  const {store,m}=mission('m14-epoch-amend');addFailure(m,'old-1');addFailure(m,'old-2',m.continuation.generation,Date.now()+1)
  assert.equal(route(m).feedback.confidence['p/a'],'low');assert.equal(route(m).resolution.primary,'p/a','feedback is telemetry and explicit role order remains authoritative')
  applyStructuredFollowup(store,m.identity.session_id,'run one more verifier',{message_kind:'verification',likely_verification:['targeted-tests']})
  assert.equal(m.continuation.generation,2);assert.equal(route(m).feedback.confidence['p/a'],'low');assert.equal(route(m).resolution.primary,'p/a','verification-only control change must preserve telemetry without rerouting')
  applyStructuredFollowup(store,m.identity.session_id,'also change the bounded implementation',{message_kind:'amendment'})
  assert.equal(m.continuation.generation,3);assert.equal(route(m).feedback.samples['p/a'],undefined);assert.equal(route(m).resolution.primary,'p/a','pre-amendment feedback must leave the active telemetry window')
  assert.equal(m.execution.workers.filter(w=>w.id.startsWith('old-')).length,2,'historical worker evidence is preserved, not deleted')
})

test('M14 material constraint decays prior feedback and fresh same-epoch evidence can re-admit it',()=>{
  const {store,m}=mission('m14-epoch-constraint');addFailure(m,'old-1');addFailure(m,'old-2',m.continuation.generation,Date.now()+1)
  applyStructuredFollowup(store,m.identity.session_id,'do not touch tests',{message_kind:'constraint'})
  assert.equal(route(m).resolution.primary,'p/a')
  addFailure(m,'fresh-1',m.continuation.generation,Date.now()+2);assert.equal(route(m).feedback.confidence['p/a'],'insufficient')
  addFailure(m,'fresh-2',m.continuation.generation,Date.now()+3);assert.equal(route(m).feedback.confidence['p/a'],'low');assert.equal(route(m).resolution.primary,'p/a','fresh feedback may be analyzed without rerouting explicit role order')
})

test('M14 non-material and stop/resume lifecycle generations do not decay model feedback',()=>{
  const {store,m}=mission('m14-epoch-control');addFailure(m,'old-1');addFailure(m,'old-2',m.continuation.generation,Date.now()+1)
  applyStructuredFollowup(store,m.identity.session_id,'thanks',{material:false,message_kind:'non-material'})
  assert.equal(route(m).resolution.primary,'p/a')
  store.stop(m.identity.session_id,'fixture-stop');store.resume(m.identity.session_id,'fixture-resume')
  assert.equal(route(m).feedback.confidence['p/a'],'low');assert.equal(route(m).resolution.primary,'p/a','stop/resume preserves feedback telemetry without making it routing authority')
})

test('M14 unattributed legacy generation fails closed after a material semantic boundary',()=>{
  const {store,m}=mission('m14-epoch-legacy');addFailure(m,'legacy-1');addFailure(m,'legacy-2',m.continuation.generation,Date.now()+1)
  for(const worker of m.execution.workers)delete worker.generation_at_spawn
  assert.equal(route(m).feedback.confidence['p/a'],'low','legacy generation may participate in telemetry before any material boundary');assert.equal(route(m).resolution.primary,'p/a')
  applyStructuredFollowup(store,m.identity.session_id,'materially amend the implementation',{message_kind:'amendment'})
  assert.equal(route(m).feedback.samples['p/a'],undefined);assert.equal(route(m).resolution.primary,'p/a')
})

test('M14 explicit model authority remains above feedback before and after material decay',()=>{
  const {store,m}=mission('m14-epoch-authority');addFailure(m,'old-1');addFailure(m,'old-2',m.continuation.generation,Date.now()+1)
  assert.equal(route(m,'p/a').resolution.primary,'p/a')
  applyStructuredFollowup(store,m.identity.session_id,'change the implementation contract',{message_kind:'amendment'})
  assert.equal(route(m,'p/a').resolution.primary,'p/a')
})

test('M14 old READY methodology candidate is inert until fresh observation; history is not wall-clock expired',()=>{
  const root=mkdtempSync(join(tmpdir(),'m14-methodology-freshness-'))
  try{
    const observation={key:'reusable-how',procedure:'Apply the reusable project procedure.',trigger:'Reusable project surface changes.',do_not_trigger:'Reusable project surface is untouched.',exit_condition:'Reusable project contract is verified.',evidence:['targeted-tests']}
    const id=methodologyCandidateID(observation),digest=methodologyCandidateDigest(observation),old=Date.now()-365*24*60*60*1000,path=projectMethodologyCandidatePath(root,id);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify({schema:1,id,key:observation.key,contract_sha256:digest,procedure:observation.procedure,trigger:observation.trigger,do_not_trigger:observation.do_not_trigger,exit_condition:observation.exit_condition,state:'READY',observations:[{mission_id:'old-m1',task_id:'old-t1',worker_id:'old-w1',evidence:['targeted-tests'],observed_at:old-1},{mission_id:'old-m2',task_id:'old-t2',worker_id:'old-w2',evidence:['targeted-tests'],observed_at:old}],created_at:old-100,updated_at:old},null,2)+'\n')
    const learning=new ProjectMethodologyLearningStore(root),store=new MissionStore(root),m=startAssessedMission(store,'m14-methodology-event','new related task'),worker={id:'fresh-w',task_id:'fresh-t',role:'coder',category:'standard',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,model:'p/a',fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'fresh',status:'completed',attempt:1,generation_at_spawn:m.continuation.generation,updated_at:Date.now(),completed_at:Date.now()}
    const historical=learning.all()[0],stale=methodologyCandidateAssessment(historical);assert.equal(historical.state,'READY');assert.equal(stale.eligible,false);assert.equal(stale.reason,'confidence-below-floor');assert.equal(stale.freshness,'DECAYED');assert.ok(stale.effective_confidence<.1);assert.equal(m.methodology.methodology_needs.some(x=>x.signal==='project.methodology-gap'),false,'loading historical derived candidate alone must not create active methodology work')
    const out=learning.observe(m,worker,observation,[{id:'ev-m14-fresh-methodology',kind:'targeted-tests'}]),fresh=methodologyCandidateAssessment(out);assert.equal(out.state,'READY');assert.equal(out.observations.length,3);assert.equal(out.learning?.positive,3);assert.equal(out.learning?.negative,0);assert.equal(out.learning?.alpha,4);assert.equal(out.learning?.beta,1);assert.equal(fresh.eligible,true);assert.ok(fresh.effective_confidence>=.7);assert.equal(m.methodology.methodology_needs.some(x=>x.signal==='project.methodology-gap'),true,'fresh evidence-backed observation restores confidence and makes uncovered candidate actionable again')
  }finally{rmSync(root,{recursive:true,force:true})}
})
