import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {OperationalToolProvisioner,discoverOperationalToolOnPath} from '../dist/runtime/tools/provisioning.js'
import {projectOperationalToolImplementationRoot,projectOperationalToolLockPath,projectOperationalToolReceiptPath,projectOperationalToolRoot} from '../dist/runtime/storage/ownership.js'
import {isOperationalToolDefinition} from '../dist/contracts/operational-tool.js'

const tempBase=()=>process.env.TMPDIR??tmpdir()
function fixture(){const root=mkdtempSync(join(tempBase(),'hi-operational-tool-'));writeFileSync(join(root,'package.json'),'{"name":"app","dependencies":{"left-pad":"1.0.0"}}\n');writeFileSync(join(root,'package-lock.json'),'{"lockfileVersion":3}\n');return{root,packageJson:readFileSync(join(root,'package.json'),'utf8'),lock:readFileSync(join(root,'package-lock.json'),'utf8'),cleanup:()=>rmSync(root,{recursive:true,force:true})}}
const definition=(overrides={})=>({capability:'source-query',implementation_id:'query-cli',dependency_class:'operational-tool',version:'1.2.3',provision_scope:'project-local',smoke:'--version',...overrides})
function executable(path){mkdirSync(join(path,'bin'),{recursive:true});const file=join(path,'bin','query-cli');writeFileSync(file,'tool');return file}

test('code-owned operational tool definitions reject product/global-style shapes',()=>{
  assert.equal(isOperationalToolDefinition(definition()),true)
  assert.equal(isOperationalToolDefinition({...definition(),dependency_class:'product-dependency'}),false)
  assert.equal(isOperationalToolDefinition({...definition(),provision_scope:'global'}),false)
})

test('existing implementation discovery wins without provisioning and writes a bounded project receipt',async()=>{
  const f=fixture();let provisions=0
  try{
    const existing=join(f.root,'existing-query');writeFileSync(existing,'tool')
    const p=new OperationalToolProvisioner(f.root,[{definition:definition(),discover:()=>({executable_path:existing,source:'path',scope:'existing',version:'1.2.3'}),provision:async c=>{provisions++;return{executable_path:executable(c.implementation_root),scope:'project-local',version:'1.2.3'}},smoke:async()=>({ok:true,detail:'version ok',version:'1.2.3'})}])
    const r=await p.ensure('source-query')
    assert.equal(r.status,'existing');assert.equal(r.scope,'existing');assert.equal(r.discovery_source,'path');assert.equal(provisions,0);assert.equal(r.dependency_class,'operational-tool');assert.equal(r.project_tool_root,projectOperationalToolRoot(f.root));assert.equal(r.smoke.ok,true)
    assert.equal(r.receipt_path,projectOperationalToolReceiptPath(f.root,'source-query','query-cli'));assert.equal(JSON.parse(readFileSync(r.receipt_path,'utf8')).executable_path,existing)
    assert.equal(readFileSync(join(f.root,'package.json'),'utf8'),f.packageJson);assert.equal(readFileSync(join(f.root,'package-lock.json'),'utf8'),f.lock)
  }finally{f.cleanup()}
})

test('project-local provisioning requires authority, stays confined, smoke-verifies, persists and dedupes concurrent callers',async()=>{
  const f=fixture();let provisions=0,ready=false
  try{
    const p=new OperationalToolProvisioner(f.root,[{definition:definition(),discover:c=>ready?({executable_path:join(c.implementation_root,'bin','query-cli'),source:'project-local-cache',scope:'project-local',version:'1.2.3'}):undefined,provision:async c=>{provisions++;await new Promise(r=>setTimeout(r,20));const path=executable(c.implementation_root);ready=true;return{executable_path:path,scope:'project-local',version:'1.2.3'}},smoke:async path=>({ok:existsSync(path),detail:'smoke passed',version:'1.2.3'})}])
    await assert.rejects(()=>p.ensure('source-query'),/requires authority context/);assert.equal(provisions,0)
    const authority={source:'task-requirement',ref:'mission:verification'}
    const [a,b]=await Promise.all([p.ensure('source-query',{authority}),p.ensure('source-query',{authority})])
    assert.equal(provisions,1);assert.equal(a.status,'provisioned');assert.deepEqual(b,a);assert.equal(a.scope,'project-local');assert.equal(a.authority.source,'task-requirement');assert.ok(a.executable_path.startsWith(projectOperationalToolImplementationRoot(f.root,'source-query','query-cli')));assert.equal(existsSync(projectOperationalToolLockPath(f.root,'source-query','query-cli')),false)
    const cached=await p.ensure('source-query',{authority});assert.equal(cached.status,'cached');assert.equal(provisions,1)
    assert.equal(readFileSync(join(f.root,'package.json'),'utf8'),f.packageJson);assert.equal(readFileSync(join(f.root,'package-lock.json'),'utf8'),f.lock)
  }finally{f.cleanup()}
})

test('failed smoke cleans owned provisioned payload and fails closed',async()=>{
  const f=fixture();let cleaned=0
  try{
    const p=new OperationalToolProvisioner(f.root,[{definition:definition(),discover:()=>undefined,provision:async c=>({executable_path:executable(c.implementation_root),scope:'project-local'}),smoke:async()=>({ok:false,detail:'bad version'}),cleanup:async provisioned=>{cleaned++;rmSync(join(provisioned.executable_path,'..','..'),{recursive:true,force:true})}}])
    await assert.rejects(()=>p.ensure('source-query',{authority:{source:'explicit-user'}}),/failed smoke/);assert.equal(cleaned,1);assert.equal(existsSync(projectOperationalToolReceiptPath(f.root,'source-query','query-cli')),false)
  }finally{f.cleanup()}
})

test('project-local provisioner cannot escape its owned implementation root',async()=>{
  const f=fixture();let cleaned=0
  try{
    const escaped=join(f.root,'escaped-tool');writeFileSync(escaped,'x')
    const p=new OperationalToolProvisioner(f.root,[{definition:definition(),discover:()=>undefined,provision:async()=>({executable_path:escaped,scope:'project-local'}),smoke:async()=>({ok:true}),cleanup:()=>{cleaned++}}])
    await assert.rejects(()=>p.ensure('source-query',{authority:{source:'explicit-user'}}),/escaped its owned implementation root/);assert.equal(cleaned,1)
  }finally{f.cleanup()}
})

test('PATH discovery is deterministic and exact-extension aware',()=>{
  const calls=[];const exists=path=>{calls.push(path);return path==='/b/query'}
  assert.equal(discoverOperationalToolOnPath('query',{env:{PATH:'/a:/b'},platform:'linux',exists}),'/b/query')
  assert.deepEqual(calls,['/a/query','/b/query'])
  const win=[];const winExists=path=>{win.push(path);return path==='C:\\B\\query.cmd'}
  const pathJoin=(left,right)=>`${left}\\${right}`
  assert.equal(discoverOperationalToolOnPath('query.cmd',{env:{PATH:'C:\\A;C:\\B',PATHEXT:'.EXE;.CMD'},platform:'win32',exists:winExists,pathJoin}),'C:\\B\\query.cmd')
  assert.deepEqual(win,['C:\\A\\query.cmd','C:\\B\\query.cmd'])
})
