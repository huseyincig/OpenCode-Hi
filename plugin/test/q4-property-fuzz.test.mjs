import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertCanonicalId, normalizeBoundedProjectPath } from '../dist/contracts/common.js'
import { validatePermissionProfile } from '../dist/contracts/permission-profile.js'
import { isWorkerResultContract } from '../dist/contracts/worker-result.js'
import { normalizeProjectPath } from '../dist/runtime/evidence/evidence-runtime.js'
import { resolveHiConfig } from '../dist/config/resolver.js'
import { normalizeOpenCodeEvent } from '../dist/opencode/event-adapter.js'
import { RuntimeEventController } from '../dist/runtime/application/runtime-event-controller.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { requireAuthority, approvePendingAuthority } from '../dist/runtime/safety/authority.js'
import { parseWorkerResult } from '../dist/runtime/task/result-parser.js'
import { RuntimePersistence, RUNTIME_STATE_SCHEMA } from '../dist/runtime/state/persistence.js'

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const failureRoot=join(repoRoot,'data/validation/property-fuzz-failures')
export const FUZZ_SEEDS=[0x00c0ffee,0x5eed1234,0x00a11ce]
export const CASES_PER_SEED=32

function rng(seed){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/0x100000000}}
function pick(r,xs){return xs[Math.floor(r()*xs.length)]}
function word(r,n=8){const a='abcdefghijklmnopqrstuvwxyz0123456789';let s='';for(let i=0;i<n;i++)s+=a[Math.floor(r()*a.length)];return s}
function saveFailure(area,seed,index,input,error){mkdirSync(failureRoot,{recursive:true});const path=join(failureRoot,`${area}-seed-${seed.toString(16)}-case-${index}.json`);writeFileSync(path,JSON.stringify({schema:1,area,seed,index,input,error:String(error?.stack??error)},null,2)+'\n')}
async function cases(area,fn){for(const seed of FUZZ_SEEDS){const r=rng(seed);for(let i=0;i<CASES_PER_SEED;i++){let input;try{input=await fn(r,i,seed)}catch(error){saveFailure(area,seed,i,input,error);throw error}}}}

test('Q4 seeded property fuzz: canonical IDs accept valid syntax and reject malformed forms',async()=>{
  await cases('ids',(r)=>{const valid=`a${word(r,1+r()*10|0)}`;assert.equal(assertCanonicalId(valid),valid);const invalid=pick(r,['',`A${word(r)}`,`-${word(r)}`,`${word(r)}..x`,`${word(r)} x`,`${word(r)}/x`,`${word(r)}_`]);assert.throws(()=>assertCanonicalId(invalid));return{valid,invalid}})
})

test('Q4 seeded property fuzz: paths remain project-bounded',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-q4-path-'))
  try{await cases('paths',(r)=>{const rel=`${word(r,4)}/${word(r,5)}.ts`;assert.equal(normalizeBoundedProjectPath(rel),rel);assert.equal(normalizeProjectPath(join(root,...rel.split('/')),root),rel);const bad=pick(r,[`../${word(r)}`,`a/../${word(r)}`,`/${word(r)}`,`//${word(r)}`,`C:/${word(r)}`,`a//${word(r)}`]);assert.equal(normalizeBoundedProjectPath(bad),undefined);return{rel,bad}})}finally{rmSync(root,{recursive:true,force:true})}
})

test('Q4 seeded property fuzz: strict schemas reject widening unknown and malformed permission profiles',async()=>{
  await cases('schemas',(r)=>{const base={id:`profile-${word(r,5)}`,rules:[{capability:'edit',action:'deny'}],safetyClass:'strict',mayBeWidenedByLowerLayer:false,hostMappingRequirements:['native-permissions']};assert.equal(validatePermissionProfile(base).mayBeWidenedByLowerLayer,false);const variant=pick(r,['unknown','widen','action','duplicate','id']);const bad=structuredClone(base);if(variant==='unknown')bad.extra=true;if(variant==='widen')bad.mayBeWidenedByLowerLayer=true;if(variant==='action')bad.rules[0].action='maybe';if(variant==='duplicate')bad.rules.push({...bad.rules[0]});if(variant==='id')bad.id='INVALID ID';assert.throws(()=>validatePermissionProfile(bad));return{variant,bad}})
})

function controllerFor(store){return new RuntimeEventController({state:{config:resolveHiConfig({}),hostConfig:{}},host:{refreshRuntimeInventory:async()=>{},log:async()=>{}},services:{store,background:{pendingFor:()=>[]},persistence:{save:()=>{}},tasks:{resolveChildCallback:()=>undefined},teams:{expireMission:async()=>{},reconcileMission:async()=>{}},processRuntime:{},workspaceRuntime:undefined,eventSink:()=>{},scopedStores:{}},projectAuthority:{grant:()=>{}},pendingNativePermissions:new Map(),projectRoot:repoRoot})}

test('Q4 seeded property fuzz: permission event ordering and duplicates never leave phantom pending authority',async()=>{
  await cases('event-ordering',async(r,i,seed)=>{const sid=`fuzz-${seed}-${i}`,store=new MissionStore(),m=store.start(sid,'event ordering'),ctl=controllerFor(store),pid=`p-${word(r,7)}`;const asked=normalizeOpenCodeEvent({type:'permission.asked',properties:{sessionID:sid,id:pid,patterns:['git push *']}}),replied=normalizeOpenCodeEvent({type:'permission.replied',properties:{sessionID:sid,permissionID:pid,response:'once',patterns:['git push *']}});const seq=pick(r,[[asked,replied],[replied,asked],[asked,asked,replied],[replied,replied,asked],[asked,replied,replied,asked]]);for(const ev of seq){ev.sessionID=sid;await ctl.handle(ev);assert.ok(m.authority.pending_permissions>=0)}assert.equal(m.authority.pending_permissions,0);assert.deepEqual(m.authority.pending_permission_ids,[]);return{pid,sequence:seq.map(x=>x.rawType)}})
})

test('Q4 seeded property fuzz: malformed host observations normalize without unbounded output or fabricated permission decisions',async()=>{
  await cases('host-observations',(r)=>{const raw={type:pick(r,[undefined,null,42,'session.status','permission.replied','weird.event']),properties:pick(r,[null,{},'text',{status:{type:word(r,5)}},{response:word(r,8),patterns:Array.from({length:250},()=>word(r,12))},{nested:{a:[word(r),42,null]}}])};const ev=normalizeOpenCodeEvent(raw);assert.equal(typeof ev.kind,'string');assert.equal(typeof ev.rawType,'string');assert.equal(typeof ev.status,'string');assert.ok(ev.filePaths.length<=200);if(ev.permission){assert.ok(['once','always','reject','unknown'].includes(ev.permission.reply));assert.ok(['allow','deny','unknown'].includes(ev.permission.decision));assert.ok(ev.permission.patterns.every(x=>typeof x==='string'))}return raw})
})

test('Q4 seeded property fuzz: malformed config resolves to bounded canonical executable values',async()=>{
  await cases('config',(r)=>{const weird=pick(r,[NaN,Infinity,-Infinity,-999,0,1.7,999,'7',null,{},[]]);const raw={unknown:word(r),routing:{maxFallbacks:weird,strategy:pick(r,['cost','quality','cost-quality','bogus',42]),allowedProviders:[word(r),null,word(r)]},parallel:{max:weird,enabled:pick(r,[true,false,'true',0]),providers:{x:weird}},execution:{maxAgents:weird,parallelism:weird},teamMode:{maxMembers:weird,maxWallMinutes:weird},profile:{balanced:{specialistThreshold:pick(r,['low','medium','high','evil',42]),surprise:'nope'}}};const c=resolveHiConfig(raw);assert.ok(c.routing.maxFallbacks>=0&&c.routing.maxFallbacks<=6);assert.ok(c.parallel.max>=1&&c.parallel.max<=8);assert.ok(c.execution.maxAgents>=1&&c.execution.maxAgents<=8);assert.ok(c.execution.parallelism>=1&&c.execution.parallelism<=8);assert.ok(c.teamMode.maxMembers>=2&&c.teamMode.maxMembers<=8);assert.ok(c.teamMode.maxWallMinutes>=1&&c.teamMode.maxWallMinutes<=240);assert.equal('unknown' in c,false);assert.equal('surprise' in c.profile.balanced,false);return raw})
})

test('Q4 seeded property fuzz: decision payloads cannot authorize without exact structured identity',async()=>{
  await cases('decision-payloads',(r,i,seed)=>{const store=new MissionStore(),m=store.start(`auth-${seed}-${i}`,'authority fuzz');try{requireAuthority(m,'git push origin main',repoRoot)}catch{}const d=m.authority.human_decision,p=m.authority.authority?.pending;assert.ok(d&&p);const bad=pick(r,[null,{},'approve',{response:'approve'},{decision_id:d.decision_id,authority_ref:p.hash,response:'success'},{decision_id:`hd_${word(r,20)}`,authority_ref:p.hash,response:'approve'},{decision_id:d.decision_id,authority_ref:`bad-${word(r)}`,response:'approve'}]);assert.equal(approvePendingAuthority(m,bad),false);assert.equal(Boolean(m.authority.authority?.approved),false);return bad})
})

test('Q4 seeded property fuzz: arbitrary tool/worker output parsing is bounded and canonical',async()=>{
  await cases('tool-outputs',(r)=>{const raw=pick(r,[word(r,40),`STATUS: ${pick(r,['DONE','FAILED','BLOCKED','WHAT'])}\nSUMMARY: ${word(r,80)}`,JSON.stringify({status:pick(r,['DONE','FAILED','BLOCKED','WHAT']),summary:word(r,80),changed_files:[`../${word(r)}`,`src/${word(r)}.ts`],evidence:'bad',open_issues:[42,word(r)],needs_context:null}),`\`\`\`json\n{"status":"DONE","summary":"${word(r,20)}","changed_files":["src/a.ts"]}\n\`\`\``,'{'.repeat(100)+word(r,500)]);const out=parseWorkerResult(raw);assert.equal(isWorkerResultContract(out),true);assert.ok(out.summary.length<=4000);assert.ok(out.changed_files.length<=200);assert.ok(out.changed_files.every(x=>normalizeBoundedProjectPath(x)===x));return{raw:raw.slice(0,500)}})
})

test('Q4 seeded property fuzz: persistence envelopes reject malformed schema and shape while valid round-trips survive',async()=>{
  await cases('persistence-envelopes',(r,i,seed)=>{const root=mkdtempSync(join(tmpdir(),'hi-q4-state-'));try{const store=new MissionStore(),m=store.start(`persist-${seed}-${i}`,'persistence fuzz'),p=new RuntimePersistence(root);p.save([m],true);const valid=JSON.parse(readFileSync(p.path,'utf8'));assert.equal(p.load().length,1);const kind=pick(r,['schema','extra','runtime','missions','mission']);const bad=structuredClone(valid);if(kind==='schema')bad.schema=RUNTIME_STATE_SCHEMA+1;if(kind==='extra')bad.extra=true;if(kind==='runtime')delete bad.runtime.clean_shutdown;if(kind==='missions')bad.missions={};if(kind==='mission')bad.missions[0].identity.extra='x';writeFileSync(p.path,JSON.stringify(bad));const p2=new RuntimePersistence(root);assert.deepEqual(p2.load(),[]);assert.ok(p2.lastLoadReport.error);return{kind}}finally{rmSync(root,{recursive:true,force:true})}})
})
