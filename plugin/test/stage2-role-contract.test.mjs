import test from 'node:test'
import assert from 'node:assert/strict'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'
import {startAssessedMission} from './helpers/semantic.mjs'

const CHILD=['coder','architect','repository-explorer','qa-reviewer','security-reviewer','visual-qa']
function runtime(policy){const created=[];const client={session:{create:async req=>{created.push(req);return{data:{id:'child-'+created.length}}},promptAsync:async()=>({data:{}}),abort:async()=>({data:{}}),diff:async()=>({data:[]})}};const cfg=resolveHiConfig({executionPolicy:policy,parallel:{enabled:true,max:4}});const rt=new TaskRuntime(client,new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:4})),process.cwd(),process.cwd(),()=>cfg,()=>[{id:'p/model',provider:'p',quality:8,cost:1,tags:['balanced'],writeCapable:true}],()=>({}));return{rt,created}}
function designMission(id){const store=new MissionStore();return startAssessedMission(store,id,'opaque design work',{task_kind:'implementation',scope:'repo-wide',risk:'medium',required_capabilities:['design-exploration'],likely_verification:[]})}

test('executionPolicy profile changes the actual default OpenCode child role',async()=>{const minimal=runtime('minimal'),m1=designMission('minimal-role');const a=await minimal.rt.start(m1,{objective:'bounded design-related task'});assert.equal(m1.tasks.find(t=>t.id===a.task_id)?.role,'coder');assert.equal(minimal.created[0].body.agent,'coder');const thorough=runtime('thorough'),m2=designMission('thorough-role');const b=await thorough.rt.start(m2,{objective:'bounded design-related task'});assert.equal(m2.tasks.find(t=>t.id===b.task_id)?.role,'architect');assert.equal(thorough.created[0].body.agent,'architect')})

test('repo-wide bug default task role starts with repository exploration, not architecture',async()=>{const x=runtime('balanced'),store=new MissionStore(),m=startAssessedMission(store,'wide-bug-role','opaque wide bug',{task_kind:'bug-fix',scope:'repo-wide',risk:'medium',required_capabilities:['implementation','verification'],likely_verification:['targeted-tests']});const out=await x.rt.start(m,{objective:'bound the root-cause surface'});assert.equal(m.tasks.find(t=>t.id===out.task_id)?.role,'repository-explorer');assert.equal(x.created[0].body.agent,'repository-explorer')})

test('packaged child role prompts defer output shape to Hi WorkerResult handoff',()=>{for(const role of CHILD){const prompt=String(PACKAGED_HI_AGENTS[role].prompt);assert.match(prompt,/structured `WorkerResult` contract|structured WorkerResult contract/i,role);assert.doesNotMatch(prompt,/Return `STATUS:/,role)}})
