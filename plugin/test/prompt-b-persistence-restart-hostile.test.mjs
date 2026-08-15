import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs'
import {dirname,join} from 'node:path'
import {tmpdir} from 'node:os'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {RuntimePersistence,RUNTIME_STATE_SCHEMA} from '../dist/runtime/state/persistence.js'
import {openHumanDecision} from '../dist/runtime/human-decision/runtime.js'
import {addEvidence} from '../dist/runtime/evidence/evidence-runtime.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {startAssessedMission} from './helpers/semantic.mjs'

function mission(store,id='persist-a'){
  const m=startAssessedMission(store,id,'persist all control planes')
  const t=createTask(m,{objective:'persist task',role:'coder',category:'quick',scope:['src/a.ts'],requiredEvidence:['targeted-tests']})
  const w=createWorker(m,t,'host-default',[],[],[]);w.session_id=`child-${id}`;w.status='busy';t.status='running'
  m.context.context_artifacts.push({id:'ctx_1',kind:'source',title:'ctx',sha256:'a'.repeat(64),added_at:Date.now()})
  m.vcs.changed_files=['src/a.ts'];m.vcs.temporary_mutations.push({id:'tm1',kind:'test',description:'temp',rollback_command:'echo rollback',rollback_hash:'x',status:'active',created_at:1})
  m.authority.pending_permissions=1;m.authority.pending_permission_ids=['perm1']
  m.release.release_chain={blocked_reason:'external-proof-pending'}
  m.methodology.parent_loaded_methodologies=['hi-systematic-debugging']
  addEvidence(m,{kind:'targeted-tests',summary:'proof',scope:['src/a.ts'],source:'session:child',outcome:'passed',pass:true});const ev=m.execution.evidence.items.at(-1);if(ev)ev.id='e_persist'
  openHumanDecision(m,{semantic_type:'operational_action',reason_code:'environment-action',summary:'repair env',task_id:t.id,worker_id:w.id,response_schema:{kind:'external-action'}})
  return m
}

test('PROMPT B persistence round-trip preserves every durable control plane and unclean restore invalidates only ephemeral/freshness state',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-pb-persist-all-'))
  try{
    const store=new MissionStore(root),m=mission(store),p=new RuntimePersistence(root);p.save(store.all(),false)
    const loaded=p.load();assert.equal(loaded.length,1)
    const x=loaded[0];for(const key of ['identity','execution','continuation','context','vcs','authority','release','methodology'])assert.ok(x[key],key)
    assert.equal(x.execution.tasks.length,1);assert.equal(x.execution.workers.length,1);assert.equal(x.authority.human_decision.status,'OPEN');assert.equal(x.execution.evidence.items[0].id,'e_persist')
    const restored=new MissionStore(root);restored.restore(loaded,true);const r=restored.get('persist-a');assert.ok(r)
    assert.equal(r.execution.tasks[0].id,x.execution.tasks[0].id);assert.equal(r.execution.workers[0].id,x.execution.workers[0].id)
    assert.equal(r.authority.pending_permissions,0);assert.equal(r.execution.evidence.fresh,false);assert.ok(r.execution.evidence.items[0].invalidated_at)
    assert.equal(r.authority.human_decision.status,'OPEN');assert.equal(r.release.release_chain.blocked_reason,'external-proof-pending');assert.deepEqual(r.methodology.parent_loaded_methodologies,['hi-systematic-debugging']);assert.deepEqual(r.vcs.changed_files,['src/a.ts'])
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('PROMPT B persistence rejects corrupt partial old and unknown schema without silently loading data',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-pb-persist-corrupt-'))
  try{
    const p=new RuntimePersistence(root);mkdirSync(dirname(p.path),{recursive:true})
    for(const body of ['{',JSON.stringify({schema:RUNTIME_STATE_SCHEMA-1,missions:[]}),JSON.stringify({schema:999,missions:[]}),JSON.stringify({schema:RUNTIME_STATE_SCHEMA,missions:'bad'})]){
      writeFileSync(p.path,body);assert.deepEqual(p.load(),[]);assert.ok(p.lastLoadReport.error)
    }
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('PROMPT B orphan partial tmp file never overrides last committed primary state',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-pb-persist-tmp-'))
  try{
    const store=new MissionStore(root);mission(store);const p=new RuntimePersistence(root);p.save(store.all(),true);const primary=readFileSync(p.path,'utf8')
    writeFileSync(`${p.path}.tmp`,'{"schema":10');assert.equal(existsSync(`${p.path}.tmp`),true)
    const loaded=p.load();assert.equal(loaded.length,1);assert.equal(readFileSync(p.path,'utf8'),primary)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('PROMPT B duplicate persisted session or Mission identity fails closed instead of last-write-wins replay',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-pb-persist-dupe-'))
  try{
    const store=new MissionStore(root),a=mission(store,'dup-a'),p=new RuntimePersistence(root)
    const otherStore=new MissionStore(root),b=mission(otherStore,'dup-a')
    assert.notEqual(b.identity.mission_id,a.identity.mission_id);assert.throws(()=>p.save([a,b]),/duplicate session identity/)
    const thirdStore=new MissionStore(root),c=mission(thirdStore,'dup-c');c.identity.mission_id=a.identity.mission_id;for(const task of c.execution.tasks)task.mission_id=a.identity.mission_id;for(const worker of c.execution.workers)worker.parent_mission_id=a.identity.mission_id
    assert.throws(()=>p.save([a,c]),/duplicate mission identity/)
    assert.throws(()=>new MissionStore(root).restore([a,b]),/Duplicate restored session identity/)
    assert.throws(()=>new MissionStore(root).restore([a,c]),/Duplicate restored mission identity/)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('PROMPT B persistence refuses invalid Mission before replacing the last valid committed state',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-pb-persist-invalid-save-'))
  try{
    const store=new MissionStore(root),m=mission(store),p=new RuntimePersistence(root);p.save([m],true);const before=readFileSync(p.path,'utf8')
    const invalid=structuredClone(m);invalid.identity.mission_id='bad'
    assert.throws(()=>p.save([invalid]),/refusing to persist invalid mission state/);assert.equal(readFileSync(p.path,'utf8'),before)
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('PROMPT B load rejects duplicate persisted identities and malformed current-schema envelope metadata',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-pb-persist-load-dupe-'))
  try{
    const store=new MissionStore(root),a=mission(store,'load-a'),p=new RuntimePersistence(root);p.save([a],true);const base=JSON.parse(readFileSync(p.path,'utf8'))
    const otherStore=new MissionStore(root),b=mission(otherStore,'load-a');base.missions=[a,b];writeFileSync(p.path,JSON.stringify(base));assert.deepEqual(p.load(),[]);assert.match(p.lastLoadReport.error,/duplicate persisted session identity/)
    const clean=JSON.parse(JSON.stringify(base));clean.missions=[a];clean.runtime.started_at='bad';writeFileSync(p.path,JSON.stringify(clean));assert.deepEqual(p.load(),[]);assert.match(p.lastLoadReport.error,/runtime envelope invalid/)
    const unknown=JSON.parse(JSON.stringify(clean));unknown.runtime.started_at=Date.now();unknown.unexpected=true;writeFileSync(p.path,JSON.stringify(unknown));assert.deepEqual(p.load(),[]);assert.match(p.lastLoadReport.error,/envelope keys invalid/)
  }finally{rmSync(root,{recursive:true,force:true})}
})
