#!/usr/bin/env node
import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {resolveCategory} from '../plugin/dist/runtime/routing/category.js'
import {resolveExecutionMode} from '../plugin/dist/runtime/routing/execution-mode.js'
import {minimumTeamFor} from '../plugin/dist/runtime/routing/minimum-team.js'
import {decideTopology} from '../plugin/dist/runtime/execution/topology-policy.js'
import {verificationPolicyFor} from '../plugin/dist/runtime/verification/policy.js'
import {ConcurrencyScheduler} from '../plugin/dist/runtime/scheduler/concurrency.js'
import {normalizeOpenCodeEvent} from '../plugin/dist/opencode/event-adapter.js'
import {MissionStore} from '../plugin/dist/runtime/mission/mission-store.js'
import {evaluateCompletion} from '../plugin/dist/runtime/completion/evaluator.js'
import {addEvidence} from '../plugin/dist/runtime/evidence/evidence-runtime.js'
import {recoveryPlan} from '../plugin/dist/runtime/continuation/recovery.js'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const corpus=JSON.parse(readFileSync(resolve(root,'data/validation/replay-corpus.json'),'utf8'))
const semantic=readFileSync(resolve(root,'data/validation/decision-replay/semantic-routing.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
const shaText=x=>createHash('sha256').update(x).digest('hex')
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) ;return value}
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
const shaFile=rel=>createHash('sha256').update(readFileSync(resolve(root,rel))).digest('hex')
const git=(...args)=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr||r.stdout);return r.stdout.trim()}
function assessment(intent){return{material:true,message_kind:'mission',task_kind:intent.taskKind,scope:intent.scope,risk:intent.risk,ambiguity:intent.ambiguity,dependency_class:intent.dependencyClass,required_capabilities:[...intent.requiredCapabilities],requested_external_actions:[...intent.requestedExternalActions],likely_verification:[...intent.likelyVerification],likely_targets:[...(intent.likelyTargets??[])],intent_signals:[],suppressed_intent_signals:[]}}
function completionMission(id){const store=new MissionStore(),m=store.start(id,'replay completion');const intent={objective:'replay completion',likelyTargets:[],taskKind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependencyClass:'independent',requiredCapabilities:['implementation'],requestedExternalActions:[],likelyVerification:[],avoid:[]};store.applyInitialSemanticAssessment(id,assessment(intent));for(const o of m.execution.obligations)o.status='closed';addEvidence(m,{kind:'changed-surface-sanity',summary:'replay canonical completion proof',scope:[],source:'replay-fixture',pass:true,outcome:'passed'});return m}
function reasonClasses(reasons){return reasons.map(x=>String(x).split(':')[0])}
function executeReplay(){
 const out={semantic_routing:[],worker_scheduling:[],host_events:[],completion:[],recovery:[]}
 for(const row of semantic){const p=verificationPolicyFor(row.intent),team=minimumTeamFor(row.intent,p),topology=decideTopology(row.intent);out.semantic_routing.push({id:row.id,actual:{category:resolveCategory(row.intent),execution_mode:resolveExecutionMode(row.intent).mode,primary_role:team.primary,direct:team.direct,roles:team.roles,topology:topology.mode,agent_count:topology.agentCount,parallelism:topology.parallelism,require_review:p.requireReview},expected:row.expected})}
 for(const row of corpus.worker_scheduling){const scheduler=new ConcurrencyScheduler(()=>row.policy);for(const op of row.operations){if(op.op==='acquire'){if(!scheduler.acquire(op.id,op.provider,op.model))throw new Error(`${row.id}: setup acquire failed`)}else if(op.op==='release')scheduler.release(op.id);else throw new Error(`${row.id}: unknown operation`)}out.worker_scheduling.push({id:row.id,actual:scheduler.canStart(row.query.id,row.query.provider,row.query.model),expected:row.expected})}
 for(const row of corpus.host_events){const e=normalizeOpenCodeEvent(row.raw);out.host_events.push({id:row.id,actual:{kind:e.kind,rawType:e.rawType,sessionID:e.sessionID??null,status:e.status,filePaths:[...e.filePaths],permission:e.permission?{id:e.permission.id??null,reply:e.permission.reply,decision:e.permission.decision,patterns:[...e.permission.patterns]}:null},expected:row.expected})}
 for(const row of corpus.completion){const m=completionMission(`replay-${row.id}`);if(row.scenario==='stopped'){m.identity.status='stopped';m.continuation.user_interrupted=true}else if(row.scenario==='active-worker'){m.execution.tasks.push({id:'t-replay',obligation_ids:[],dependencies:[],status:'running'});m.execution.workers.push({id:'w-replay',task_id:'t-replay',role:'coder',category:'standard',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'replay',status:'busy',attempt:0,generation_at_spawn:m.continuation.generation,updated_at:1})}else if(row.scenario==='verification-missing'){const v=m.execution.obligations.find(o=>o.kind==='verification');if(!v)throw new Error('verification obligation missing');v.status='open';v.requiredEvidence=['targeted-tests'];m.execution.verification_policy.requiredKinds=['targeted-tests'];m.execution.evidence.fresh=false}else if(row.scenario==='reconcile'){m.execution.tasks.push({id:'t-replay',obligation_ids:[],dependencies:[],status:'waiting',result:{status:'FIX_REQUIRED'}})}else if(row.scenario!=='clean')throw new Error(`${row.id}: unknown completion scenario`);const c=evaluateCompletion(m);out.completion.push({id:row.id,actual:{complete:c.complete,next:c.next??null,reason_classes:reasonClasses(c.reasons)},expected:row.expected})}
 for(const row of corpus.recovery){const m=completionMission(`replay-${row.id}`);m.continuation.stagnation_count=row.stagnation_count;const r=recoveryPlan(m);out.recovery.push({id:row.id,actual:{level:r.level,action:r.action},expected:row.expected})}
 return out
}
function mismatches(run){const bad=[];for(const [surface,rows] of Object.entries(run))for(const row of rows)if(!same(row.actual,row.expected))bad.push({surface,id:row.id,expected:row.expected,actual:row.actual});return bad}
const first=executeReplay(),second=executeReplay(),m1=mismatches(first),m2=mismatches(second),digest1=shaText(JSON.stringify(canonical(first))),digest2=shaText(JSON.stringify(canonical(second))),drift=digest1!==digest2
const ownerFiles=['plugin/src/runtime/routing/category.ts','plugin/src/runtime/routing/execution-mode.ts','plugin/src/runtime/routing/minimum-team.ts','plugin/src/runtime/execution/topology-policy.ts','plugin/src/runtime/verification/policy.ts','plugin/src/runtime/scheduler/concurrency.ts','plugin/src/opencode/event-adapter.ts','plugin/src/runtime/completion/evaluator.ts','plugin/src/runtime/continuation/recovery.ts']
const counts=Object.fromEntries(Object.entries(first).map(([k,v])=>[k,v.length]))
const receipt={schema:1,kind:'PROMPT_B_REPLAY_ACCEPTANCE',program:'PROMPT_B',section:33,status:(!drift&&!m1.length&&!m2.length)?'PASS':'FAIL',source_binding:{tested_git_commit:git('rev-parse','HEAD'),tested_git_tree:git('rev-parse','HEAD^{tree}')},inputs:{'data/validation/replay-corpus.json':shaFile('data/validation/replay-corpus.json'),'data/validation/decision-replay/semantic-routing.jsonl':shaFile('data/validation/decision-replay/semantic-routing.jsonl')},owner_hashes:Object.fromEntries(ownerFiles.map(x=>[x,shaFile(x)])),surface_counts:counts,total_cases:Object.values(counts).reduce((a,b)=>a+b,0),first_pass_digest:digest1,second_pass_digest:digest2,nondeterministic_semantic_drift:drift,mismatches:[...m1,...m2],claim_boundary:'Machine-readable deterministic replay over canonical semantic/routing, scheduler, host-event normalization, completion, and recovery owners. Replay detects semantic output drift; it is not live-provider/T3 evidence.'}
writeFileSync(resolve(root,'data/validation/replay-acceptance-0.1.0.json'),JSON.stringify(receipt,null,2)+'\n')
console.log(`replay acceptance ${receipt.status}: cases=${receipt.total_cases} drift=${drift} mismatches=${receipt.mismatches.length}`)
if(receipt.status!=='PASS')process.exitCode=1
