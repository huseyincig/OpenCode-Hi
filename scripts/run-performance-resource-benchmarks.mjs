#!/usr/bin/env node
import {performance} from 'node:perf_hooks'
import {spawnSync} from 'node:child_process'
import {mkdtempSync,rmSync,statSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {writeFileSync} from 'node:fs'
import {MissionStore} from '../plugin/dist/runtime/mission/mission-store.js'
import {createTask} from '../plugin/dist/runtime/worker/worker-runtime.js'
import {SkillCatalogIndex} from '../plugin/dist/runtime/skills/catalog-index.js'
import {retrieveProjectIntelligence} from '../plugin/dist/runtime/project-intelligence/retrieval.js'
import {governContext} from '../plugin/dist/runtime/context/governor.js'
import {RuntimePersistence} from '../plugin/dist/runtime/state/persistence.js'
import {ConcurrencyScheduler} from '../plugin/dist/runtime/scheduler/concurrency.js'
import {OpenCodePtyAdapter} from '../plugin/dist/opencode/open-code-pty-adapter.js'
import {providerUsageObservation,contextBudgetEstimator} from '../plugin/dist/runtime/context/budget-estimator.js'

const ROOT=resolve(new URL('..',import.meta.url).pathname)
const out=resolve(process.argv[2]??'data/validation/performance-resource-benchmarks-0.1.0.json')
const now=()=>performance.now()
const median=xs=>{const a=[...xs].sort((a,b)=>a-b);return a[Math.floor(a.length/2)]}
const band=(v,threshold,unit)=>({status:v<=threshold?'PASS':'FAIL',threshold:`<=${threshold}${unit}`,observed_bucket:`<=${threshold}${unit}`})
const samples=(n,fn)=>{const xs=[];for(let i=0;i<n;i++){const s=now();fn(i);xs.push(now()-s)}return xs}

// Startup: cold Node process + importing the packaged plugin entrypoint. Node 24.19 libuv teardown is accepted only after STARTUP_READY.
const startup=[]
for(let i=0;i<5;i++){
 const s=now(),r=spawnSync(process.execPath,['-e',"import('./plugin/dist/plugin.js').then(()=>console.log('STARTUP_READY'))"],{cwd:ROOT,encoding:'utf8',timeout:5000}),ms=now()-s
 const known=r.status===null&&r.signal==='SIGABRT'&&String(r.stdout).includes('STARTUP_READY')&&String(r.stderr).includes("uv__io_poll: Assertion `errno == EEXIST' failed")
 if(!(r.status===0||known)||!String(r.stdout).includes('STARTUP_READY'))throw new Error(`startup benchmark failed: ${r.status}/${r.signal} ${r.stderr}`)
 startup.push(ms)
}

// Task initialization: canonical Mission + Task owner, 100 bounded initializations.
const taskInit=samples(100,i=>{const store=new MissionStore(`/tmp/hi-bench-task-${i}`),m=store.start(`bench-${i}`,'benchmark task');createTask(m,{objective:'benchmark task',role:'coder',category:'quick',scope:['src/a.ts']})})

// Skill discovery/cache: first full scan followed by fingerprint-based cached read.
const skillIndex=new SkillCatalogIndex(ROOT,ROOT);let t=now();const skillCold=skillIndex.records({});const skillColdMs=now()-t;t=now();const skillCached=skillIndex.records({});const skillCachedMs=now()-t;const skillDiag=skillIndex.diagnostics()

// Project Intelligence retrieval: 500 eligible items, 50 identical bounded top-k queries.
const pi=Array.from({length:500},(_,i)=>({id:`pi-${i}`,statement:`Authentication token contract pattern ${i%20}`,source_refs:[{ref:`file:src/auth/file-${i%40}.ts`,hash:'a'.repeat(64)}],confidence:.8,freshness:'FRESH',lifecycle:'ACTIVE',consumer_domains:['task-context'],updated_at:i+1}))
const piTimes=samples(50,()=>retrieveProjectIntelligence(pi,{query:'authentication token contract',files:['src/auth/file-3.ts'],consumer:'task-context',limit:6}))

// Context build/governor: 200 entries with protected/compressible/purgeable classes.
const entries=Array.from({length:200},(_,i)=>({id:`ctx-${i}`,kind:i===0?'objective':'tool',text:'x'.repeat(500),contextClass:i===0?'PROTECTED':i%3===0?'PURGEABLE':'COMPRESSIBLE',createdAt:i+1}))
t=now();const governed=governContext(entries,{maxChars:12000,compressToChars:6000});const contextMs=now()-t

// Persistence: 30 save/load cycles on a valid pending Mission, plus exact serialized byte size.
const stateRoot=mkdtempSync(join(tmpdir(),'hi-bench-state-'));let persistenceMs=0,stateBytes=0
try{const store=new MissionStore(stateRoot);store.start('bench-persist','benchmark persistence');const p=new RuntimePersistence(stateRoot);t=now();for(let i=0;i<30;i++){p.save(store.all(),i===29);if(p.load().length!==1)throw new Error('persistence benchmark load drift')}persistenceMs=now()-t;stateBytes=statSync(p.path).size}finally{rmSync(stateRoot,{recursive:true,force:true})}

// Scheduling: 100k bounded canStart checks under provider/model capacity policy.
const scheduler=new ConcurrencyScheduler(()=>({global:8,providers:{p:4},models:{'p/m':2}}));scheduler.acquire('held','p','p/m');t=now();let schedulingChecks=0;for(let i=0;i<100000;i++){scheduler.canStart(`w-${i}`,'p','p/m');schedulingChecks++}const schedulingMs=now()-t;scheduler.release('held')

// Process output resource bounds are executable owner values; hostile tests separately feed 1MiB+ output.
const pty=new OpenCodePtyAdapter({},new URL('http://127.0.0.1:1'),ROOT,ROOT,()=>({}))
const processOutput={max_buffered_chars:pty.maxBufferedChars,max_read_chars:pty.maxReadChars,injected_output_chars:1024*1024,bounded_ratio:Number((pty.maxBufferedChars/(1024*1024)).toFixed(4))}

// Memory growth: local canonical operations, broad safety threshold; receipt stores only a stable threshold bucket.
global.gc?.();const heapBefore=process.memoryUsage().heapUsed
for(let i=0;i<1000;i++){const store=new MissionStore(`/tmp/hi-bench-mem-${i}`);store.start(`mem-${i}`,'memory benchmark')}
for(let i=0;i<100;i++)retrieveProjectIntelligence(pi,{query:'token contract',files:['src/auth/file-1.ts'],consumer:'task-context',limit:6})
global.gc?.();const heapAfter=process.memoryUsage().heapUsed;const heapGrowth=Math.max(0,heapAfter-heapBefore)

// Token usage: exact provider observation remains exact; heuristic is explicitly estimated.
const observed=providerUsageObservation([{info:{role:'assistant',providerID:'openai',modelID:'bench',tokens:{input:321,output:12,reasoning:0,cache:{read:0,write:0}}},parts:[]}])
const estimated=contextBudgetEstimator.estimate({content:'x'.repeat(2000)},'openai/bench')

const metrics={
 startup:{samples:5,unit:'ms',...band(median(startup),1000,'ms')},
 task_initialization:{samples:100,unit:'ms-total',...band(taskInit.reduce((a,b)=>a+b,0),250,'ms')},
 skill_discovery_cache:{records:skillCold.length,cached_records:skillCached.length,full_scans:skillDiag.full_scans,fingerprint_checks:skillDiag.fingerprint_checks,cold:{...band(skillColdMs,500,'ms')},cached:{...band(skillCachedMs,500,'ms')}},
 pi_retrieval:{items:500,queries:50,top_k:6,...band(piTimes.reduce((a,b)=>a+b,0),1000,'ms')},
 context_build:{input_chars:entries.reduce((n,e)=>n+e.text.length,0),output_chars:governed.afterChars,action:governed.action,...band(contextMs,250,'ms')},
 persistence:{cycles:30,state_bytes:stateBytes,...band(persistenceMs,1000,'ms')},
 scheduling:{checks:schedulingChecks,...band(schedulingMs,1000,'ms')},
 process_output:{...processOutput,status:processOutput.max_buffered_chars===256*1024&&processOutput.max_read_chars===64*1024?'PASS':'FAIL'},
 memory_growth:{operations:1100,...band(heapGrowth,64*1024*1024,'bytes')},
 token_usage:{provider_observed:observed,estimated,status:observed?.value===321&&observed?.confidence==='exact'&&estimated.value===500&&estimated.confidence==='estimated'?'PASS':'FAIL'},
}
const status=Object.values(metrics).every(x=>x.status==='PASS'||(x.cold?.status==='PASS'&&x.cached?.status==='PASS'))?'PASS':'FAIL'
const receipt={schema:1,kind:'PROMPT_B_PERFORMANCE_RESOURCE_BENCHMARK',program:'PROMPT_B',section:35,status,source_binding:{tested_git_commit:spawnSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).stdout.trim(),tested_git_tree:spawnSync('git',['rev-parse','HEAD^{tree}'],{cwd:ROOT,encoding:'utf8'}).stdout.trim()},metrics,existing_policy_benchmark:'data/validation/benchmarks-0.1.0.json',claim_boundary:'Local deterministic/bounded resource benchmark. Timing is classified only into broad pass thresholds to keep canonical evidence stable; no provider wall-clock latency, provider billing, or fabricated exact token usage is claimed. Exact tokens originate only from provider usage observations.',optimization_decision:'NO_NEW_SCHEDULER_OR_WORK_STEALING_COMPLEXITY_WITHOUT_MEASURED_BENEFIT'}
writeFileSync(out,JSON.stringify(receipt,null,2)+'\n')
console.log(`performance/resource benchmark ${status}: startup_median_ms=${median(startup).toFixed(2)} task_total_ms=${taskInit.reduce((a,b)=>a+b,0).toFixed(2)} skill_cold_ms=${skillColdMs.toFixed(2)} skill_cached_ms=${skillCachedMs.toFixed(2)} pi_total_ms=${piTimes.reduce((a,b)=>a+b,0).toFixed(2)} context_ms=${contextMs.toFixed(2)} persistence_ms=${persistenceMs.toFixed(2)} scheduling_ms=${schedulingMs.toFixed(2)} heap_growth=${heapGrowth}`)
process.exit(status==='PASS'?0:1)
