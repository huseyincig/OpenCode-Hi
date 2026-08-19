#!/usr/bin/env node
import {performance} from 'node:perf_hooks'
import {spawnSync} from 'node:child_process'
import {mkdtempSync,rmSync,statSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {writeFileSync} from 'node:fs'
import {MissionStore} from '../plugin/dist/runtime/mission/mission-store.js'
import {createTask} from '../plugin/dist/runtime/worker/worker-runtime.js'
import {methodologySkillCandidates,resolveSkillPlan} from '../plugin/dist/runtime/skills/registry.js'
import {ProjectMethodologyLearningStore} from '../plugin/dist/runtime/project-intelligence/methodology-learning.js'
import {buildMissionRuntimeProjection,measureMissionRuntimeProjection} from '../plugin/dist/runtime/context/mission-runtime-projection.js'
import {RuntimePersistence} from '../plugin/dist/runtime/state/persistence.js'
import {ConcurrencyScheduler} from '../plugin/dist/runtime/scheduler/concurrency.js'
import {OpenCodePtyAdapter} from '../plugin/dist/opencode/open-code-pty-adapter.js'
import {providerUsageObservation,contextBudgetEstimator} from '../plugin/dist/runtime/context/budget-estimator.js'

const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)))
const out=resolve(process.argv[2]??'data/validation/performance-resource-benchmarks-0.1.0.json')
const now=()=>performance.now(),median=xs=>{const a=[...xs].sort((a,b)=>a-b);return a[Math.floor(a.length/2)]},band=(v,threshold,unit)=>({status:v<=threshold?'PASS':'FAIL',threshold:`<=${threshold}${unit}`,observed_bucket:`<=${threshold}${unit}`}),samples=(n,fn)=>{const xs=[];for(let i=0;i<n;i++){const s=now();fn(i);xs.push(now()-s)}return xs}
const assessed=(store,id,objective='benchmark task')=>{const m=store.start(id,objective);store.applyInitialSemanticAssessment(id,{material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:['src/a.ts'],intent_signals:[],suppressed_intent_signals:[]});return m}

const startup=[]
for(let i=0;i<5;i++){const s=now(),r=spawnSync(process.execPath,['-e',"import('./plugin/dist/plugin.js').then(()=>console.log('STARTUP_READY'))"],{cwd:ROOT,encoding:'utf8',timeout:5000}),ms=now()-s,known=r.status===null&&r.signal==='SIGABRT'&&String(r.stdout).includes('STARTUP_READY')&&String(r.stderr).includes("uv__io_poll: Assertion `errno == EEXIST' failed");if(!(r.status===0||known)||!String(r.stdout).includes('STARTUP_READY'))throw new Error(`startup benchmark failed: ${r.status}/${r.signal} ${r.stderr}`);startup.push(ms)}
const taskInit=samples(100,i=>{const store=new MissionStore(`/tmp/hi-bench-task-${i}`),m=store.start(`bench-${i}`,'benchmark task');createTask(m,{objective:'benchmark task',role:'coder',category:'quick',scope:['src/a.ts']})})

const skillNames=['hi-test-strategy','hi-verification-before-completion'];let skillSelected=0,t=now();for(let i=0;i<100;i++){const candidates=methodologySkillCandidates(skillNames,ROOT,ROOT,{}),plan=resolveSkillPlan(skillNames,candidates,undefined,true,'coder');skillSelected+=plan.selected.length}const skillMs=now()-t
const learnRoot=mkdtempSync(join(tmpdir(),'hi-bench-learning-'));let learningMs=0,readyAt=0
try{const learning=new ProjectMethodologyLearningStore(learnRoot);t=now();for(let i=0;i<20;i++){const store=new MissionStore(learnRoot),m=assessed(store,`learn-${i}`,'repeat project procedure'),w={id:`w${i}`,task_id:`t${i}`,role:'coder',category:'standard',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:`f${i}`,status:'completed',generation_at_spawn:m.continuation.generation},item=learning.observe(m,w,{key:'bench-how',procedure:'Run the bounded project contract check.',trigger:'Bench source changes.',do_not_trigger:'Bench source unchanged.',exit_condition:'Bounded check passes.',evidence:['bench-proof']},['bench-proof']);if(item?.state==='READY'&&!readyAt)readyAt=i+1}learningMs=now()-t}finally{rmSync(learnRoot,{recursive:true,force:true})}
const projectionStore=new MissionStore('/tmp/hi-bench-projection'),projectionMission=assessed(projectionStore,'projection','bounded projection');projectionMission.execution.blockers=['bounded-blocker'];projectionMission.execution.constraints=['preserve user work'];t=now();let projectionChars=0;for(let i=0;i<1000;i++)projectionChars+=measureMissionRuntimeProjection(buildMissionRuntimeProjection(projectionMission)).dynamic_chars;const projectionMs=now()-t

const stateRoot=mkdtempSync(join(tmpdir(),'hi-bench-state-'));let persistenceMs=0,stateBytes=0
try{const store=new MissionStore(stateRoot);store.start('bench-persist','benchmark persistence');const p=new RuntimePersistence(stateRoot);t=now();for(let i=0;i<30;i++){p.save(store.all(),i===29);if(p.load().length!==1)throw new Error('persistence benchmark load drift')}persistenceMs=now()-t;stateBytes=statSync(p.path).size}finally{rmSync(stateRoot,{recursive:true,force:true})}
const scheduler=new ConcurrencyScheduler(()=>({global:8,providers:{p:4},models:{'p/m':2}}));scheduler.acquire('held','p','p/m');t=now();let schedulingChecks=0;for(let i=0;i<100000;i++){scheduler.canStart(`w-${i}`,'p','p/m');schedulingChecks++}const schedulingMs=now()-t;scheduler.release('held')
const pty=new OpenCodePtyAdapter({},new URL('http://127.0.0.1:1'),ROOT,ROOT,()=>({})),processOutput={max_buffered_chars:pty.maxBufferedChars,max_read_chars:pty.maxReadChars,injected_output_chars:1024*1024,bounded_ratio:Number((pty.maxBufferedChars/(1024*1024)).toFixed(4))}
global.gc?.();const heapBefore=process.memoryUsage().heapUsed
for(let i=0;i<1000;i++){const store=new MissionStore(`/tmp/hi-bench-mem-${i}`),m=store.start(`mem-${i}`,'memory benchmark');buildMissionRuntimeProjection(m)}
for(let i=0;i<100;i++){const candidates=methodologySkillCandidates(['hi-test-strategy'],ROOT,ROOT,{});resolveSkillPlan(['hi-test-strategy'],candidates,undefined,true,'coder')}
global.gc?.();const heapAfter=process.memoryUsage().heapUsed,heapGrowth=Math.max(0,heapAfter-heapBefore)
const observed=providerUsageObservation([{info:{role:'assistant',providerID:'openai',modelID:'bench',tokens:{input:321,output:12,reasoning:0,cache:{read:0,write:0}}},parts:[]}]),estimated=contextBudgetEstimator.estimate({content:'x'.repeat(2000)},'openai/bench')
const metrics={startup:{samples:5,unit:'ms',...band(median(startup),1000,'ms')},task_initialization:{samples:100,unit:'ms-total',...band(taskInit.reduce((a,b)=>a+b,0),250,'ms')},skill_selection:{iterations:100,requested_per_iteration:2,selected_total:skillSelected,...band(skillMs,1000,'ms')},project_methodology_learning:{observations:20,ready_at_observation:readyAt,...band(learningMs,1000,'ms')},context_projection:{iterations:1000,total_projected_chars:projectionChars,...band(projectionMs,500,'ms')},persistence:{cycles:30,state_bytes:stateBytes,...band(persistenceMs,1000,'ms')},scheduling:{checks:schedulingChecks,...band(schedulingMs,1000,'ms')},process_output:{...processOutput,status:processOutput.max_buffered_chars===256*1024&&processOutput.max_read_chars===64*1024?'PASS':'FAIL'},memory_growth:{operations:1100,...band(heapGrowth,64*1024*1024,'bytes')},token_usage:{provider_observed:observed,estimated,status:observed?.value===321&&observed?.confidence==='exact'&&estimated.value===500&&estimated.confidence==='estimated'?'PASS':'FAIL'}}
const status=Object.values(metrics).every(x=>x.status==='PASS')?'PASS':'FAIL',commit=spawnSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).stdout.trim(),tree=spawnSync('git',['rev-parse','HEAD^{tree}'],{cwd:ROOT,encoding:'utf8'}).stdout.trim()
const receipt={schema:2,kind:'PROMPT_B_PERFORMANCE_RESOURCE_BENCHMARK',program:'PROMPT_B',section:35,status,source_binding:{tested_git_commit:commit,tested_git_tree:tree},metrics,existing_policy_benchmark:'data/validation/benchmarks-0.1.0.json',claim_boundary:'Local deterministic/bounded resource benchmark over current Phase 2 hot paths. Timing is classified only into broad pass thresholds; no provider wall-clock latency, provider billing, or fabricated exact token usage is claimed. Exact tokens originate only from provider usage observations.',optimization_decision:'NO_NEW_SCHEDULER_OR_WORK_STEALING_COMPLEXITY_WITHOUT_MEASURED_BENEFIT'}
writeFileSync(out,JSON.stringify(receipt,null,2)+'\n');console.log(`performance/resource benchmark ${status}: startup=${median(startup).toFixed(2)}ms skill=${skillMs.toFixed(2)}ms learning=${learningMs.toFixed(2)}ms projection=${projectionMs.toFixed(2)}ms persistence=${persistenceMs.toFixed(2)}ms scheduling=${schedulingMs.toFixed(2)}ms`);process.exit(status==='PASS'?0:1)
