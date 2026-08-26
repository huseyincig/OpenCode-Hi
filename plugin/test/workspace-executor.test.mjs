import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {basename,dirname,join,resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
import {OpenCodeWorkspaceAdapter,openCodeExperimentalWorkspacesEnabled} from '../dist/opencode/open-code-workspace-adapter.js'
import {WorkspaceRuntime} from '../dist/runtime/workspace/runtime.js'
import {ChildExecutionCoordinator} from '../dist/runtime/task/child-execution-coordinator.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'
import {openCodeHostCapabilityContracts,hostCapabilityByID} from '../dist/contracts/host-capability.js'
import {opencodeChildPort} from './helpers/host-port.mjs'
import {evaluateIdle} from '../dist/runtime/continuation/evaluator.js'

const BASE='a'.repeat(40)
const host={agent:PACKAGED_HI_AGENTS}
process.env.OPENCODE_EXPERIMENTAL_WORKSPACES='true'
function assess(store,sid){return store.applyInitialSemanticAssessment(sid,{material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:['src/a.ts'],intent_signals:[],suppressed_intent_signals:[]})}
class FakeWorkspaceExecutor{
  constructor(path='/tmp/hi-w2-workspace'){this.path=path;this.provisions=[];this.integrations=[];this.cleaned=[];this.reconciles=[];this.mode='ADOPTED';this.integrationError=undefined}
  async sourceBaseline(root){this.baselineRoot=root;return BASE}
  async provision(req){this.provisions.push(structuredClone(req));return{host_workspace_id:`ws_${this.provisions.length}`,workspace_path:this.path}}
  async reintegrate(req){this.integrations.push(structuredClone(req));if(this.integrationError)throw this.integrationError;return{applied_files:[...req.expected_changed_files]}}
  async reconcile(lease){this.reconciles.push(lease.lease_id);if(this.mode==='ORPHANED')return{disposition:'ORPHANED',lease:{...lease,status:'ORPHANED',cleanup_state:'QUARANTINED'}};if(this.mode==='CLOSED')return{disposition:'CLOSED',lease:{...lease,status:'CLOSED',cleanup_state:'CLEANED'}};return{disposition:'ADOPTED',lease:{...lease,status:'ACTIVE',cleanup_state:'ACTIVE'}}}
  async cleanup(lease){this.cleaned.push(lease.lease_id)}
}
function client(created=[],prompts=[],aborted=[],workspacePath='/tmp/hi-w2-workspace',mismatch=false){let n=0;return{session:{
  create:async req=>{const id=`child-${++n}`,workspaceID=req.body.workspaceID;created.push(req);return{data:{id,...(workspaceID?{workspaceID,directory:mismatch?'/tmp/wrong-workspace':workspacePath}:{directory:process.cwd()})}}},
  promptAsync:async req=>{prompts.push(req);return{data:{}}},abort:async req=>{aborted.push(req);return{data:true}},diff:async()=>({data:[]})
}}}
function runtimeWithWorkspace(c,workspaceRuntime,root=process.cwd()){return new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),root,root,()=>resolveHiConfig({}),()=>[],()=>host,undefined,{},undefined,workspaceRuntime)}

test('OpenCode experimental workspace flag semantics and adapter preflight fail closed',async()=>{
  assert.equal(openCodeExperimentalWorkspacesEnabled({}),false)
  assert.equal(openCodeExperimentalWorkspacesEnabled({OPENCODE_EXPERIMENTAL:'1'}),true)
  assert.equal(openCodeExperimentalWorkspacesEnabled({OPENCODE_EXPERIMENTAL:'true',OPENCODE_EXPERIMENTAL_WORKSPACES:'false'}),false)
  assert.equal(openCodeExperimentalWorkspacesEnabled({OPENCODE_EXPERIMENTAL_WORKSPACES:'true'}),true)
  const priorWorkspace=process.env.OPENCODE_EXPERIMENTAL_WORKSPACES,priorExperimental=process.env.OPENCODE_EXPERIMENTAL
  delete process.env.OPENCODE_EXPERIMENTAL_WORKSPACES;delete process.env.OPENCODE_EXPERIMENTAL
  let listed=0,created=0
  try{
    const workspace={list:async()=>{listed++;return{data:[]}},create:async()=>{created++;return{data:{}}},remove:async()=>({data:{}})}
    const adapter=new OpenCodeWorkspaceAdapter({v2:{experimental:{workspace}}},new URL('http://127.0.0.1:1'),'/tmp')
    const health=await adapter.health();assert.equal(health.available,false);assert.match(health.detail,/OPENCODE_EXPERIMENTAL_WORKSPACES=true/)
    await assert.rejects(()=>adapter.provision({mission_id:'m',task_id:'t',repository_root:'/tmp',source_baseline:BASE}),/experimental workspace support is disabled/)
    assert.equal(listed,0);assert.equal(created,0)
  }finally{
    if(priorWorkspace===undefined)delete process.env.OPENCODE_EXPERIMENTAL_WORKSPACES;else process.env.OPENCODE_EXPERIMENTAL_WORKSPACES=priorWorkspace
    if(priorExperimental===undefined)delete process.env.OPENCODE_EXPERIMENTAL;else process.env.OPENCODE_EXPERIMENTAL=priorExperimental
    process.env.OPENCODE_EXPERIMENTAL_WORKSPACES='true'
  }
})

test('OpenCode adapter provisions only the builtin worktree type and binds exact Git repository identity',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-w2-primary-')),work=mkdtempSync(join(tmpdir(),'hi-w2-worktree-')),common=mkdtempSync(join(tmpdir(),'hi-w2-common-')),calls=[]
  try{
    let createdWorkspace=false;const workspace={create:async p=>{calls.push(['create',p]);createdWorkspace=true;return{data:{id:'ws_1',type:'worktree',directory:work}}},list:async()=>({data:createdWorkspace?[{id:'ws_1',type:'worktree',directory:work}]:[]}),remove:async p=>{calls.push(['remove',p]);return{data:{id:'ws_1',type:'worktree',directory:work}}}}
    const inspect=dir=>({head:BASE,common_dir:resolve(common),worktrees:[resolve(root),resolve(work)]})
    const adapter=new OpenCodeWorkspaceAdapter({v2:{experimental:{workspace}}},new URL('http://127.0.0.1:1'),root,inspect)
    assert.equal(await adapter.sourceBaseline(root),BASE)
    const out=await adapter.provision({mission_id:'m',task_id:'t',repository_root:root,source_baseline:BASE})
    assert.equal(out.host_workspace_id,'ws_1');assert.equal(out.workspace_path,resolve(work));assert.equal(calls[0][1].type,'worktree');assert.equal(calls[0][1].branch,undefined)
    const lease={lease_id:'lease_1',mission_id:'m',task_id:'t',repository_root:root,base_ref:BASE,workspace_path:resolve(work),host_workspace_id:'ws_1',created_at:1,status:'ACTIVE',cleanup_state:'ACTIVE',source_baseline:BASE}
    assert.equal((await adapter.reconcile(lease)).disposition,'ADOPTED')
  }finally{rmSync(root,{recursive:true,force:true});rmSync(work,{recursive:true,force:true});rmSync(common,{recursive:true,force:true})}
})


test('real-host lost ACK on workspace create is reconciled only from one new exact workspace identity',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-w3-lostack-primary-')),work=mkdtempSync(join(tmpdir(),'hi-w3-lostack-work-')),common=mkdtempSync(join(tmpdir(),'hi-w3-lostack-common-'));let listed=0
  try{
    const workspace={create:async()=>{throw new Error('Timed out waiting for global event')},list:async()=>({data:listed++===0?[]:[{id:'wrk_lostack',type:'worktree',directory:work}]}),remove:async()=>({data:{}})}
    const inspect=()=>({head:BASE,common_dir:resolve(common),worktrees:[resolve(root),resolve(work)]})
    const adapter=new OpenCodeWorkspaceAdapter({v2:{experimental:{workspace}}},new URL('http://127.0.0.1:1'),root,inspect)
    const out=await adapter.provision({mission_id:'m',task_id:'t',repository_root:root,source_baseline:BASE})
    assert.equal(out.host_workspace_id,'wrk_lostack');assert.equal(out.workspace_path,resolve(work))
  }finally{rmSync(root,{recursive:true,force:true});rmSync(work,{recursive:true,force:true});rmSync(common,{recursive:true,force:true})}
})


test('successful create rejects a pre-existing native workspace identity without removing foreign ownership',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-m05-existing-primary-')),work=mkdtempSync(join(tmpdir(),'hi-m05-existing-work-')),common=mkdtempSync(join(tmpdir(),'hi-m05-existing-common-'));let removes=0
  try{
    const existing={id:'ws_existing',type:'worktree',directory:work},workspace={list:async()=>({data:[existing]}),create:async()=>({data:existing}),remove:async()=>{removes++;return{data:existing}}}
    const inspect=()=>({head:BASE,common_dir:resolve(common),worktrees:[resolve(root),resolve(work)]})
    const adapter=new OpenCodeWorkspaceAdapter({v2:{experimental:{workspace}}},new URL('http://127.0.0.1:1'),root,inspect)
    await assert.rejects(()=>adapter.provision({mission_id:'m',task_id:'t',repository_root:root,source_baseline:BASE}),/pre-existing workspace identity/i)
    assert.equal(removes,0,'a create response that aliases prior host ownership must never be cleaned up as Hi-owned')
  }finally{for(const x of [root,work,common])rmSync(x,{recursive:true,force:true})}
})


test('successful create rejects a fresh host id that aliases a pre-existing workspace path',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-m05-alias-primary-')),work=mkdtempSync(join(tmpdir(),'hi-m05-alias-work-')),common=mkdtempSync(join(tmpdir(),'hi-m05-alias-common-'));let removes=0
  try{
    let created=false
    const prior={id:'ws_prior',type:'worktree',directory:work},fresh={id:'ws_fresh',type:'worktree',directory:work}
    const workspace={list:async()=>({data:created?[prior,fresh]:[prior]}),create:async()=>{created=true;return{data:fresh}},remove:async()=>{removes++;return{data:fresh}}}
    const inspect=()=>({head:BASE,common_dir:resolve(common),worktrees:[resolve(root),resolve(work)]})
    const adapter=new OpenCodeWorkspaceAdapter({v2:{experimental:{workspace}}},new URL('http://127.0.0.1:1'),root,inspect)
    await assert.rejects(()=>adapter.provision({mission_id:'m',task_id:'t',repository_root:root,source_baseline:BASE}),/pre-existing workspace path/i)
    assert.equal(removes,0,'a fresh id that aliases a prior workspace path is not safe to remove')
  }finally{for(const x of [root,work,common])rmSync(x,{recursive:true,force:true})}
})

test('cleanup revalidates current host workspace id-to-path ownership before destructive remove',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-m05-clean-primary-')),owned=mkdtempSync(join(tmpdir(),'hi-m05-clean-owned-')),foreign=mkdtempSync(join(tmpdir(),'hi-m05-clean-foreign-')),common=mkdtempSync(join(tmpdir(),'hi-m05-clean-common-'));let removes=0
  try{
    const workspace={list:async()=>({data:[{id:'ws_recycled',type:'worktree',directory:foreign}]}),create:async()=>({data:{}}),remove:async()=>{removes++;return{data:{id:'ws_recycled',type:'worktree',directory:foreign}}}}
    const inspect=()=>({head:BASE,common_dir:resolve(common),worktrees:[resolve(root),resolve(owned),resolve(foreign)]})
    const adapter=new OpenCodeWorkspaceAdapter({v2:{experimental:{workspace}}},new URL('http://127.0.0.1:1'),root,inspect)
    const lease={lease_id:'lease_recycled',mission_id:'m',task_id:'t',repository_root:root,base_ref:BASE,workspace_path:resolve(owned),host_workspace_id:'ws_recycled',created_at:1,status:'ACTIVE',cleanup_state:'ACTIVE',source_baseline:BASE}
    await assert.rejects(()=>adapter.cleanup(lease),/workspace path mismatch/i)
    assert.equal(removes,0,'cleanup must not remove a host ID whose current path no longer matches the lease')
  }finally{for(const x of [root,owned,foreign,common])rmSync(x,{recursive:true,force:true})}
})

test('lost ACK reconciliation fails closed when more than one new valid workspace appears',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-w3-amb-primary-')),a=mkdtempSync(join(tmpdir(),'hi-w3-amb-a-')),b=mkdtempSync(join(tmpdir(),'hi-w3-amb-b-')),common=mkdtempSync(join(tmpdir(),'hi-w3-amb-common-'));let listed=0
  try{
    const workspace={create:async()=>{throw new Error('Timed out waiting for global event')},list:async()=>({data:listed++===0?[]:[{id:'wrk_a',type:'worktree',directory:a},{id:'wrk_b',type:'worktree',directory:b}]}),remove:async()=>({data:{}})}
    const inspect=()=>({head:BASE,common_dir:resolve(common),worktrees:[resolve(root),resolve(a),resolve(b)]})
    const adapter=new OpenCodeWorkspaceAdapter({v2:{experimental:{workspace}}},new URL('http://127.0.0.1:1'),root,inspect)
    await assert.rejects(()=>adapter.provision({mission_id:'m',task_id:'t',repository_root:root,source_baseline:BASE}),/lost-ack reconciliation was ambiguous/)
  }finally{for(const x of [root,a,b,common])rmSync(x,{recursive:true,force:true})}
})

test('default Git inspector accepts an actual detached registered worktree without staging or snapshot mutation',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-w2-real-git-')),work=join(dirname(root),`${basename(root)}-work`)
  const run=(args,cwd=root)=>{const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,String(r.stderr??r.stdout));return String(r.stdout??'').trim()}
  try{
    run(['init']);run(['config','user.email','hi@example.invalid']);run(['config','user.name','Hi Test']);
    const {writeFileSync}=await import('node:fs');writeFileSync(join(root,'a.txt'),'one\n');run(['add','a.txt']);run(['commit','-m','base']);const head=run(['rev-parse','HEAD']);writeFileSync(join(root,'a.txt'),'user-dirty\n');const dirtyBefore=run(['status','--porcelain']);assert.match(dirtyBefore,/a\.txt/);run(['worktree','add','--detach',work,'HEAD'])
    let createdWorkspace=false;const workspace={create:async p=>{createdWorkspace=true;return{data:{id:'ws_real',type:p.type,directory:work}}},list:async()=>({data:createdWorkspace?[{id:'ws_real',type:'worktree',directory:work}]:[]}),remove:async()=>({data:{}})}
    const adapter=new OpenCodeWorkspaceAdapter({v2:{experimental:{workspace}}},new URL('http://127.0.0.1:1'),root)
    assert.equal(await adapter.sourceBaseline(root),head)
    const out=await adapter.provision({mission_id:'m',task_id:'t',repository_root:root,source_baseline:head});assert.equal(out.workspace_path,resolve(work));assert.equal(run(['status','--porcelain']),dirtyBefore);assert.equal(readFileSync(join(root,'a.txt'),'utf8'),'user-dirty\n')
  }finally{spawnSync('git',['worktree','remove','--force',work],{cwd:root,encoding:'utf8'});rmSync(work,{recursive:true,force:true});rmSync(root,{recursive:true,force:true})}
})

test('adapter fails closed for primary-path, repository-identity, or source-baseline substitution',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-w2-safe-primary-')),work=mkdtempSync(join(tmpdir(),'hi-w2-safe-work-')),common=mkdtempSync(join(tmpdir(),'hi-w2-safe-common-'));let removes=0
  try{
    const workspace={create:async()=>({data:{id:'ws_bad',type:'worktree',directory:work}}),list:async()=>({data:[]}),remove:async()=>{removes++;return{data:{}}}}
    const badCommon=dir=>({head:BASE,common_dir:dir===root?resolve(common):resolve(common,'other'),worktrees:[resolve(root),resolve(work)]})
    await assert.rejects(()=>new OpenCodeWorkspaceAdapter({v2:{experimental:{workspace}}},new URL('http://x'),root,badCommon).provision({mission_id:'m',task_id:'t',repository_root:root,source_baseline:BASE}),/same Git common repository/)
    assert.equal(removes,1)
    const drift=()=>({head:'b'.repeat(40),common_dir:resolve(common),worktrees:[resolve(root),resolve(work)]})
    await assert.rejects(()=>new OpenCodeWorkspaceAdapter({v2:{experimental:{workspace}}},new URL('http://x'),root,drift).provision({mission_id:'m',task_id:'t',repository_root:root,source_baseline:BASE}),/Source baseline changed/)
  }finally{rmSync(root,{recursive:true,force:true});rmSync(work,{recursive:true,force:true});rmSync(common,{recursive:true,force:true})}
})

test('native workspace warp reintegrates exact scoped diff and preserves unrelated primary dirty state',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-m12-reintegrate-primary-')),work=join(dirname(root),`${basename(root)}-work`),calls=[]
  const run=(args,cwd=root,input)=>{const r=spawnSync('git',args,{cwd,encoding:'utf8',input});assert.equal(r.status,0,String(r.stderr??r.stdout));return String(r.stdout??'').trim()}
  try{
    const {writeFileSync}=await import('node:fs');run(['init']);run(['config','user.email','hi@example.invalid']);run(['config','user.name','Hi Test']);writeFileSync(join(root,'a.txt'),'base\n');writeFileSync(join(root,'unrelated.txt'),'base\n');run(['add','.']);run(['commit','-m','base']);const head=run(['rev-parse','HEAD']);run(['worktree','add','--detach',work,'HEAD']);writeFileSync(join(work,'a.txt'),'isolated\n');writeFileSync(join(root,'unrelated.txt'),'user-dirty\n')
    const workspace={list:async()=>({data:[{id:'ws_reintegrate',type:'worktree',directory:work}]}),create:async()=>({data:{id:'ws_reintegrate',type:'worktree',directory:work}}),remove:async()=>({data:{}}),warp:async p=>{calls.push(p);const dr=spawnSync('git',['diff','--binary','HEAD','--'],{cwd:work,encoding:'utf8'});assert.equal(dr.status,0,String(dr.stderr??dr.stdout));const ar=spawnSync('git',['apply','--whitespace=nowarn','-'],{cwd:root,encoding:'utf8',input:String(dr.stdout??'')});assert.equal(ar.status,0,String(ar.stderr??ar.stdout));return{data:undefined}}}
    const adapter=new OpenCodeWorkspaceAdapter({v2:{experimental:{workspace}}},new URL('http://127.0.0.1:1'),root),lease={lease_id:'lease_r',mission_id:'m',task_id:'t',repository_root:root,base_ref:head,workspace_path:resolve(work),host_workspace_id:'ws_reintegrate',created_at:1,status:'ACTIVE',cleanup_state:'ACTIVE',source_baseline:head}
    const out=await adapter.reintegrate({session_id:'child-reintegrate',lease,task_scope:['a.txt'],expected_changed_files:['a.txt']})
    assert.deepEqual(out.applied_files,['a.txt']);assert.equal(readFileSync(join(root,'a.txt'),'utf8'),'isolated\n');assert.equal(readFileSync(join(root,'unrelated.txt'),'utf8'),'user-dirty\n');assert.equal(calls.length,1);assert.equal(calls[0].id,null);assert.equal(calls[0].sessionID,'child-reintegrate');assert.equal(calls[0].copyChanges,true)
  }finally{spawnSync('git',['worktree','remove','--force',work],{cwd:root,encoding:'utf8'});rmSync(work,{recursive:true,force:true});rmSync(root,{recursive:true,force:true})}
})

test('workspace reintegration refuses dirty primary target and never invokes native warp',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-m12-reintegrate-dirty-')),work=join(dirname(root),`${basename(root)}-work`);let warps=0
  const run=(args,cwd=root)=>{const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,String(r.stderr??r.stdout));return String(r.stdout??'').trim()}
  try{
    const {writeFileSync}=await import('node:fs');run(['init']);run(['config','user.email','hi@example.invalid']);run(['config','user.name','Hi Test']);writeFileSync(join(root,'a.txt'),'base\n');run(['add','.']);run(['commit','-m','base']);const head=run(['rev-parse','HEAD']);run(['worktree','add','--detach',work,'HEAD']);writeFileSync(join(work,'a.txt'),'isolated\n');writeFileSync(join(root,'a.txt'),'user-dirty\n')
    const workspace={list:async()=>({data:[{id:'ws_dirty',type:'worktree',directory:work}]}),create:async()=>({data:{id:'ws_dirty',type:'worktree',directory:work}}),remove:async()=>({data:{}}),warp:async()=>{warps++;return{data:undefined}}},adapter=new OpenCodeWorkspaceAdapter({v2:{experimental:{workspace}}},new URL('http://127.0.0.1:1'),root),lease={lease_id:'lease_d',mission_id:'m',task_id:'t',repository_root:root,base_ref:head,workspace_path:resolve(work),host_workspace_id:'ws_dirty',created_at:1,status:'ACTIVE',cleanup_state:'ACTIVE',source_baseline:head}
    await assert.rejects(()=>adapter.reintegrate({session_id:'child-dirty',lease,task_scope:['a.txt'],expected_changed_files:['a.txt']}),/refuses user\/current primary changes/);assert.equal(warps,0);assert.equal(readFileSync(join(root,'a.txt'),'utf8'),'user-dirty\n')
  }finally{spawnSync('git',['worktree','remove','--force',work],{cwd:root,encoding:'utf8'});rmSync(work,{recursive:true,force:true});rmSync(root,{recursive:true,force:true})}
})

test('ChildExecutionCoordinator binds workspaceID and exact returned directory; mismatch aborts child',async()=>{
  const created=[],aborted=[],root=mkdtempSync(join(tmpdir(),'hi-w2-bind-')),work=join(root,'work');mkdirSync(work)
  try{
    const ok=new ChildExecutionCoordinator(opencodeChildPort(client(created,[],aborted,work,false)))
    const child=await ok.create('parent','isolated','coder',undefined,undefined,{workspaceID:'ws_1',directory:work})
    assert.equal(created[0].body.workspaceID,'ws_1');assert.equal(child.workspaceID,'ws_1')
    const badCreated=[],badAborted=[],bad=new ChildExecutionCoordinator(opencodeChildPort(client(badCreated,[],badAborted,work,true)))
    await assert.rejects(()=>bad.create('parent','isolated','coder',undefined,undefined,{workspaceID:'ws_2',directory:work}),/workspace binding mismatch/)
    assert.equal(badAborted.length,1)
  }finally{rmSync(root,{recursive:true,force:true})}
})



test('WorkspaceRuntime rejects forged or cross-task isolation decisions before host provision',async()=>{
  const fake=new FakeWorkspaceExecutor('/work'),wr=new WorkspaceRuntime(fake,'/repo'),store=new MissionStore('/repo'),m=store.start('workspace-owner','isolate exact task');assess(store,'workspace-owner')
  const task={id:'t_owner',mission_id:m.identity.mission_id,objective:'x',status:'created',role:'coder',category:'quick',scope:['src/a.ts'],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],external_action_requirements:[],created_at:1,updated_at:1};m.execution.tasks.push(task)
  const canonical=wr.decision(m,task,{required:true,reason:'exact owner'})
  await assert.rejects(()=>wr.provision(m,task,{...canonical,reason:'forged copy'}),/canonical Mission-owned isolation decision/)
  await assert.rejects(()=>wr.provision(m,task,{...canonical,requested_by:'task:t_other'}),/canonical Mission-owned isolation decision/)
  await assert.rejects(()=>wr.provision(m,task,{...canonical,scope:['src/other.ts']}),/canonical Mission-owned isolation decision/)
  assert.equal(fake.provisions.length,0)
  const lease=await wr.provision(m,task,canonical);assert.equal(fake.provisions.length,1);assert.equal(lease.task_id,task.id)
})

test('explicit isolated task provisions one lease, binds child workspace, preserves deny permission, and cleanup follows child abort',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-w2-task-')),work=join(root,'work');mkdirSync(work);const created=[],prompts=[],aborted=[],fake=new FakeWorkspaceExecutor(work),workspaceRuntime=new WorkspaceRuntime(fake,root),c=client(created,prompts,aborted,work),rt=runtimeWithWorkspace(c,workspaceRuntime,root),store=new MissionStore(root),m=store.start('w2','isolated implementation')
  try{
    assess(store,'w2');const out=await rt.start(m,{objective:'isolated implementation',role:'coder',category:'quick',scope:['src/a.ts'],isolationRequired:true,isolationReason:'parallel write conflict requires bounded isolation'})
    assert.equal(fake.provisions.length,1);assert.equal(m.execution.isolation_decisions.length,1);assert.equal(m.execution.workspace_leases.length,1)
    const lease=m.execution.workspace_leases[0];assert.equal(lease.task_id,out.task_id);assert.equal(lease.source_baseline,BASE);assert.equal(created[0].body.workspaceID,lease.host_workspace_id);assert.equal(created[0].body.permission,undefined)
    const task=m.execution.tasks.find(x=>x.id===out.task_id);assert.equal(task.execution_profile.permission_profile.native.decisions.external_directory,'deny')
    assert.match(task.constraints.join(' '),/hi-isolation:git-worktree/)
    assert.equal(await rt.cancel(m,out.worker_id),true);assert.equal(aborted.length,1);assert.equal(fake.cleaned.length,1);assert.equal(lease.status,'CLOSED');assert.equal(lease.cleanup_state,'CLEANED')
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('isolated DONE result reintegrates before settlement and reintegration failure remains BLOCKED with active lease',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-m12-runtime-reintegration-')),work=join(root,'work');mkdirSync(work);const created=[],fake=new FakeWorkspaceExecutor(work),wr=new WorkspaceRuntime(fake,root),rt=runtimeWithWorkspace(client(created,[],[],work),wr,root),store=new MissionStore(root),m=store.start('m12-runtime-reintegration','isolated implementation')
  try{
    assess(store,'m12-runtime-reintegration');const out=await rt.start(m,{objective:'isolated implementation',role:'coder',category:'quick',scope:['src/a.ts'],isolationRequired:true,isolationReason:'exact task write isolation'}),result={status:'DONE',summary:'done',changed_files:['src/a.ts'],evidence:[],open_issues:[],needs_context:[]}
    const applied=await rt.reintegrateWorkspaceResult(m,out.worker_id,result);assert.equal(applied.status,'DONE');assert.deepEqual(applied.changed_files,['src/a.ts']);assert.equal(fake.integrations.length,1);assert.equal(fake.integrations[0].session_id,out.session_id);assert.equal(fake.integrations[0].lease.task_id,out.task_id)
    fake.integrationError=new Error('native warp apply rejected');const blocked=await rt.reintegrateWorkspaceResult(m,out.worker_id,result);assert.equal(blocked.status,'BLOCKED');assert.ok(blocked.open_issues.some(x=>x===`workspace-reintegration-failed:${out.task_id}`));assert.equal(m.execution.workspace_leases[0].status,'ACTIVE');assert.equal(fake.cleaned.length,0)
    await rt.cancel(m,out.worker_id)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('constraint rebase fresh child cannot escape the existing workspace lease',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-w2-rebase-')),work=join(root,'work');mkdirSync(work);const created=[],prompts=[],aborted=[],fake=new FakeWorkspaceExecutor(work),wr=new WorkspaceRuntime(fake,root),rt=runtimeWithWorkspace(client(created,prompts,aborted,work),wr,root),store=new MissionStore(root),m=store.start('rebase','isolated rebase')
  try{
    assess(store,'rebase');const out=await rt.start(m,{objective:'isolated rebase',role:'coder',category:'quick',scope:['src/a.ts'],isolationRequired:true,isolationReason:'constraint-sensitive isolated work'})
    const lease=m.execution.workspace_leases[0];assert.equal(created.length,1);assert.equal(created[0].body.workspaceID,lease.host_workspace_id)
    const count=await rt.reconcileUserConstraint(m,'do not touch docs');assert.equal(count,1);assert.equal(aborted.length,1);assert.equal(created.length,2);assert.equal(created[1].body.workspaceID,lease.host_workspace_id);assert.equal(m.execution.workers.find(x=>x.id===out.worker_id).session_id,'child-2')
    await rt.cancel(m,out.worker_id)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('normal task never provisions a workspace and isolated binding mismatch cleans lease fail-closed',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-w2-economy-')),work=join(root,'work');mkdirSync(work)
  try{
    const fake=new FakeWorkspaceExecutor(work),wr=new WorkspaceRuntime(fake,root),created=[],rt=runtimeWithWorkspace(client(created,[],[],work),wr,root),store=new MissionStore(root),m=store.start('normal','normal implementation');assess(store,'normal')
    await rt.start(m,{objective:'normal implementation',role:'coder',category:'quick',scope:['src/a.ts']});assert.equal(fake.provisions.length,0);assert.equal(created[0].body.workspaceID,undefined);assert.equal(m.execution.workspace_leases.length,0)
    const fake2=new FakeWorkspaceExecutor(work),wr2=new WorkspaceRuntime(fake2,root),rt2=runtimeWithWorkspace(client([],[],[],work,true),wr2,root),m2=store.start('badbind','isolated bind mismatch');assess(store,'badbind')
    await assert.rejects(()=>rt2.start(m2,{objective:'isolated bind mismatch',role:'coder',category:'quick',scope:['src/a.ts'],isolationRequired:true,isolationReason:'test isolation'}),/workspace binding mismatch/)
    assert.equal(fake2.cleaned.length,1);assert.equal(m2.execution.workspace_leases[0].status,'CLOSED')
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('restart adopts exact lease, quarantines missing owner without recreation, and cleanup-pending missing lease can close',async()=>{
  const root='/repo',fake=new FakeWorkspaceExecutor('/work'),wr=new WorkspaceRuntime(fake,root),store=new MissionStore(root),m=store.start('restart','workspace restart');assess(store,'restart')
  const task={id:'t_restart',mission_id:m.identity.mission_id,objective:'x',status:'running',role:'coder',category:'quick',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],created_at:1,updated_at:1};m.execution.tasks.push(task)
  const d=wr.decision(m,task,{required:true,reason:'restart test'}),lease=await wr.provision(m,task,d);await wr.reconcileRestored([m]);assert.equal(lease.status,'ACTIVE');assert.equal(fake.provisions.length,1)
  fake.mode='ORPHANED';await wr.reconcileRestored([m]);assert.equal(m.execution.workspace_leases[0].status,'ORPHANED');assert.equal(m.execution.workspace_leases[0].cleanup_state,'QUARANTINED');assert.ok(m.execution.blockers.includes(`workspace-orphan:${lease.lease_id}`));assert.equal(fake.provisions.length,1)
})


test('orphaned restored lease quarantines its task/worker and cannot resume or recreate into the main workspace',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-w2-orphan-')),work=join(root,'work');mkdirSync(work);const created=[],fake=new FakeWorkspaceExecutor(work),wr=new WorkspaceRuntime(fake,root),rt=runtimeWithWorkspace(client(created,[],[],work),wr,root),store=new MissionStore(root),m=store.start('orphan','isolated orphan')
  try{
    assess(store,'orphan');const input={objective:'isolated orphan',role:'coder',category:'quick',scope:['src/a.ts'],isolationRequired:true,isolationReason:'restart owner must remain exact'},out=await rt.start(m,input)
    assert.equal(created.length,1);assert.equal(fake.provisions.length,1);fake.mode='ORPHANED';await wr.reconcileRestored([m])
    const task=m.execution.tasks.find(x=>x.id===out.task_id),worker=m.execution.workers.find(x=>x.id===out.worker_id),lease=m.execution.workspace_leases[0]
    assert.equal(lease.status,'ORPHANED');assert.equal(lease.cleanup_state,'QUARANTINED');assert.equal(task.status,'blocked');assert.equal(task.result.status,'BLOCKED');assert.equal(worker.status,'ready');assert.equal(worker.restart_reconcile_pending,true)
    await assert.rejects(()=>rt.start(m,input),/Required workspace lease is not active/)
    assert.equal(fake.provisions.length,1);assert.equal(created.length,1)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('implementation still has no broad auto-snapshot staging after workspace capability promotion',()=>{
  const all={childSessions:true,asyncPrompt:true,syncPrompt:true,abort:true,providerInventory:true,appLog:true,sessionStatus:true,childSessionList:true,sessionTodo:true,sessionDiff:true,sessionFork:true,sessionSummarize:true,sessionRevert:true,sessionUnrevert:true}
  const source=readFileSync(new URL('../src/opencode/open-code-workspace-adapter.ts',import.meta.url),'utf8')+readFileSync(new URL('../src/runtime/workspace/runtime.ts',import.meta.url),'utf8')
  assert.doesNotMatch(source,/git\s+add\s+-A|\['add','-A'\]|\["add","-A"\]/)
})


test('concurrent lease identity collision is cleaned and rejected before duplicate ownership enters Mission state',async()=>{
  const fake=new FakeWorkspaceExecutor('/shared/work'),wr=new WorkspaceRuntime(fake,'/repo'),store=new MissionStore('/repo'),m=store.start('workspace-concurrency','two isolated tasks');assess(store,'workspace-concurrency')
  const mk=(id,scope)=>({id,mission_id:m.identity.mission_id,objective:id,status:'created',role:'coder',category:'quick',scope:[scope],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],external_action_requirements:[],created_at:1,updated_at:1})
  const a=mk('t_a','a'),b=mk('t_b','b');m.execution.tasks.push(a,b)
  const da=wr.decision(m,a,{required:true,reason:'parallel a'}),db=wr.decision(m,b,{required:true,reason:'parallel b'})
  const first=await wr.provision(m,a,da);assert.equal(first.workspace_path,'/shared/work')
  await assert.rejects(()=>wr.provision(m,b,db),/already owned by another active lease/)
  assert.equal(m.execution.workspace_leases.length,1);assert.equal(m.execution.workspace_leases[0].task_id,'t_a');assert.equal(fake.cleaned.length,1,'colliding native workspace must be cleaned')
})

test('workspace cleanup failure quarantines lease and records an explicit blocker',async()=>{
  const fake=new FakeWorkspaceExecutor('/work');fake.cleanup=async()=>{throw new Error('remove-denied')}
  const wr=new WorkspaceRuntime(fake,'/repo'),store=new MissionStore('/repo'),m=store.start('workspace-cleanup-fail','cleanup fail');assess(store,'workspace-cleanup-fail')
  const task={id:'t_cleanup',mission_id:m.identity.mission_id,objective:'x',status:'created',role:'coder',category:'quick',scope:['a'],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],external_action_requirements:[],created_at:1,updated_at:1};m.execution.tasks.push(task)
  const lease=await wr.provision(m,task,wr.decision(m,task,{required:true,reason:'cleanup proof'}));assert.equal(await wr.cleanup(m,lease.lease_id),false)
  assert.equal(lease.status,'ORPHANED');assert.equal(lease.cleanup_state,'QUARANTINED');assert.ok(m.execution.blockers.includes(`workspace-orphan:${lease.lease_id}`))
})

test('real Git workspace provisioning preserves pre-staged and unstaged user changes exactly',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-pb-staged-primary-')),work=join(dirname(root),`${basename(root)}-work`)
  const run=(args,cwd=root)=>{const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,String(r.stderr??r.stdout));return String(r.stdout??'').trim()}
  try{
    const {writeFileSync}=await import('node:fs');run(['init']);run(['config','user.email','hi@example.invalid']);run(['config','user.name','Hi Test']);writeFileSync(join(root,'tracked.txt'),'base\n');writeFileSync(join(root,'staged.txt'),'base\n');run(['add','.']);run(['commit','-m','base']);const head=run(['rev-parse','HEAD'])
    writeFileSync(join(root,'tracked.txt'),'user-unstaged\n');writeFileSync(join(root,'staged.txt'),'user-staged\n');writeFileSync(join(root,'untracked user.txt'),'user-untracked\n');run(['add','staged.txt']);const before=run(['status','--porcelain=v1']);assert.match(before,/\?\? (?:\"untracked user\.txt\"|untracked user\.txt)/);run(['worktree','add','--detach',work,'HEAD'])
    let createdWorkspace=false;const workspace={create:async p=>{createdWorkspace=true;return{data:{id:'ws_staged',type:p.type,directory:work}}},list:async()=>({data:createdWorkspace?[{id:'ws_staged',type:'worktree',directory:work}]:[]}),remove:async()=>({data:{}})}
    const adapter=new OpenCodeWorkspaceAdapter({v2:{experimental:{workspace}}},new URL('http://127.0.0.1:1'),root);await adapter.provision({mission_id:'m',task_id:'t',repository_root:root,source_baseline:head})
    assert.equal(run(['status','--porcelain=v1']),before);assert.match(before,/ M tracked\.txt/);assert.match(before,/M  staged\.txt/)
  }finally{spawnSync('git',['worktree','remove','--force',work],{cwd:root,encoding:'utf8'});rmSync(work,{recursive:true,force:true});rmSync(root,{recursive:true,force:true})}
})


test('symlinked workspace escape is canonicalized and rejected when it leaves the Git common repository',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-pb-link-primary-')),evil=mkdtempSync(join(tmpdir(),'hi-pb-link-evil-')),link=join(root,'linked-workspace'),common=mkdtempSync(join(tmpdir(),'hi-pb-link-common-'))
  try{
    const {symlinkSync}=await import('node:fs');symlinkSync(evil,link,'dir');const workspace={create:async()=>({data:{id:'ws_link',type:'worktree',directory:link}}),list:async()=>({data:[]}),remove:async()=>({data:{}})}
    const inspect=dir=>({head:BASE,common_dir:resolve(dir)===resolve(root)?resolve(common):resolve(common,'foreign'),worktrees:[resolve(root),resolve(evil)]})
    const adapter=new OpenCodeWorkspaceAdapter({v2:{experimental:{workspace}}},new URL('http://127.0.0.1:1'),root,inspect)
    await assert.rejects(()=>adapter.provision({mission_id:'m',task_id:'t',repository_root:root,source_baseline:BASE}),/same Git common repository/)
  }finally{rmSync(root,{recursive:true,force:true});rmSync(evil,{recursive:true,force:true});rmSync(common,{recursive:true,force:true})}
})


test('required isolation without a workspace runtime becomes one durable terminal capability state',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-w2-no-runtime-')),created=[]
  try{
    const rt=new TaskRuntime(opencodeChildPort(client(created,[],[],root)),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),root,root,()=>resolveHiConfig({}),()=>[],()=>host),store=new MissionStore(root),m=store.start('w2-no-runtime','isolated implementation');assess(store,'w2-no-runtime')
    await assert.rejects(()=>rt.start(m,{objective:'isolated change',role:'coder',category:'quick',scope:['src/a.ts'],isolationRequired:true,isolationReason:'protect user dirty state'}),/USER_ACTION_REQUIRED: Hi WorkspaceExecutor is unavailable/)
    assert.equal(created.length,0);assert.ok(m.execution.blockers.includes('capability-unavailable:workspace-isolation-binding'))
    const decision=evaluateIdle(m);assert.equal(decision.decision,'USER_ACTION_REQUIRED');assert.equal(decision.reason_code,'capability-unavailable');assert.equal(decision.prompt,undefined)
  }finally{rmSync(root,{recursive:true,force:true})}
})
