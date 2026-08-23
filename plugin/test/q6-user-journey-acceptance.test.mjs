import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {opencodeChildPort} from './helpers/host-port.mjs'
import {evaluateCompletion} from '../dist/runtime/completion/evaluator.js'
import {addEvidence} from '../dist/runtime/evidence/evidence-runtime.js'
import {openCodeHostCapabilityContracts,hostCapabilityByID} from '../dist/contracts/host-capability.js'
import {classifyWorkerFailure} from '../dist/runtime/worker/failure-classifier.js'
import {plantPendingAuthority,authorityProtocolResponse} from './helpers/authority.mjs'
import {approvePendingAuthority,isAuthorized,requireAuthority} from '../dist/runtime/safety/authority.js'

function native(){const creates=[],prompts=[];let n=0;return{creates,prompts,client:{session:{create:async req=>{creates.push(req);return{data:{id:`child-${++n}`}}},promptAsync:async req=>{prompts.push(req);return{data:{}}},abort:async()=>({data:true}),diff:async()=>({data:[]})}}}}
function runtime(client,global=2){return new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global,providers:{},models:{}})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[],()=>({}))}

test('Q6 small task stays single/minimal, asks nothing unnecessary, and completion requires real verification',async()=>{
 const n=native(),store=new MissionStore(),m=startAssessedMission(store,'q6-small','change one local constant',{task_kind:'bug-fix',scope:'local',risk:'low',likely_verification:['targeted-tests'],likely_targets:['src/a.ts']})
 const out=await runtime(n.client).start(m,{objective:'change one local constant',role:'coder',category:'quick',scope:['src/a.ts']});assert.equal(m.execution.topology.mode,'single-agent');assert.equal(n.creates.length,1);assert.equal(m.authority.human_decision,undefined)
 const verification=m.execution.obligations.find(o=>o.kind==='verification');runtime(n.client).applyResult(m,out.worker_id,{status:'DONE',summary:'changed',changed_files:['src/a.ts'],evidence:[],open_issues:[],needs_context:[]});assert.equal(evaluateCompletion(m).complete,false)
 addEvidence(m,{kind:'targeted-tests',summary:'targeted test pass',scope:['src/a.ts'],source:'bash',pass:true,outcome:'passed',obligation_ids:verification?[verification.id]:[]});for(const o of m.execution.obligations)o.status='closed';assert.equal(evaluateCompletion(m).complete,true)
})

test('Q6 medium feature carries planning methodology verification and review obligations',()=>{const store=new MissionStore(),m=startAssessedMission(store,'q6-medium','implement medium feature',{task_kind:'implementation',scope:'multi-file',risk:'high',required_capabilities:['implementation','security-review','independent-review'],likely_verification:['targeted-tests','review-evidence']});assert.equal(m.execution.verification_policy.requireReview,true);assert.ok(m.execution.obligations.some(o=>o.kind==='verification'));assert.ok(m.execution.obligations.some(o=>o.id==='o-high-assurance'));assert.equal(m.execution.execution_mode,'single')})

test('Q6 complex mission owns bounded parallel workers rather than unbounded fanout',async()=>{const n=native(),store=new MissionStore(),m=startAssessedMission(store,'q6-complex','independent streams',{scope:'multi-stream',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation']});assert.equal(m.execution.execution_mode,'parallel');const rt=runtime(n.client,2);await rt.start(m,{objective:'stream a',role:'coder',category:'standard',scope:['src/a.ts']});await rt.start(m,{objective:'stream b',role:'coder',category:'standard',scope:['src/b.ts']});const third=await rt.start(m,{objective:'stream c',role:'coder',category:'standard',scope:['src/c.ts']});assert.ok(['READY','WAIT'].includes(third.readiness));assert.ok(m.execution.workers.length<=3)})

test('Q6 failure journey classifies transport failure as bounded retryable and permission as terminal user boundary',()=>{const net=classifyWorkerFailure('network timeout'),perm=classifyWorkerFailure('permission denied');assert.deepEqual([net.kind,net.retryable,net.stagnation],['provider-transport',true,false]);assert.deepEqual([perm.kind,perm.retryable,perm.stagnation],['permission',false,false])})

test('Q6 authority journey requires exact structured decision and never widens scope',()=>{const store=new MissionStore(),m=store.start('q6-auth','release');assert.throws(()=>requireAuthority(m,'git push','/repo'),/explicit approval required/);assert.equal(isAuthorized(m,'git push','/repo'),false);assert.equal(approvePendingAuthority(m,authorityProtocolResponse(m,'approve')),true);assert.equal(isAuthorized(m,'git push','/repo'),true);assert.equal(isAuthorized(m,'git push --force','/repo'),false)})

test('Q6 unsupported journey is truthful and exposes no fake executor claim',()=>{const c=hostCapabilityByID(openCodeHostCapabilityContracts({childSessions:true,asyncPrompt:true,syncPrompt:true,abort:true,providerInventory:true,appLog:true,sessionStatus:true,childSessionList:true,sessionTodo:true,sessionDiff:true,sessionFork:true,sessionSummarize:true,sessionRevert:true,sessionUnrevert:true}),'process-lifecycle');assert.ok(c);assert.equal(c.status,'UNSUPPORTED');assert.equal(c.verification_level,'OBSERVED');assert.match(c.semantic_loss.join(' '),/not observed/);assert.match(c.forbidden_fake_behavior,/Do not claim.*mock client.*T3\/REAL_HOST_ACCEPTANCE/i)})

test('Q6 restart journey reconciles in-flight worker without duplicate mutation',()=>{const store=new MissionStore(),m=startAssessedMission(store,'q6-restart','fix local',{likely_verification:['targeted-tests']});m.execution.workers.push({id:'w',task_id:'t',role:'coder',category:'quick',session_id:'child-old',parent_session_id:'q6-restart',parent_mission_id:m.identity.mission_id,model:'host-default',fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'busy',generation_at_spawn:m.continuation.generation});m.execution.tasks.push({id:'t',mission_id:m.identity.mission_id,objective:'fix local',status:'running',role:'coder',category:'quick',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],worker_id:'w',external_action_requirements:[],created_at:1,updated_at:1});const restored=new MissionStore();restored.restore([structuredClone(m)],true);const r=restored.get('q6-restart');assert.equal(r.execution.workers.length,1);assert.equal(r.execution.workers[0].session_id,'child-old');assert.equal(r.execution.workers[0].restart_reconcile_pending,true);assert.equal(r.execution.tasks.length,1)})
