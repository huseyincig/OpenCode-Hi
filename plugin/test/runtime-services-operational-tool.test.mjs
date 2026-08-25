import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createRuntimeServices} from '../dist/runtime/application/runtime-services.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {projectOperationalToolImplementationRoot,projectOperationalToolReceiptPath} from '../dist/runtime/storage/ownership.js'
import {makeChildSessionPort} from './helpers/host-port.mjs'

const tempBase=()=>process.env.TMPDIR??tmpdir()
const noopProcess={spawn:async()=>{throw new Error('not used')},write:async()=>{},read:async()=>({text:'',start_cursor:0,end_cursor:0,available_start_cursor:0,available_end_cursor:0,truncated:false,status:'RUNNING'}),wait:async()=>{throw new Error('not used')},kill:async()=>{throw new Error('not used')},cleanup:async()=>{},reconcile:async contract=>({disposition:'ORPHANED',contract})}
const noopWorkspace={sourceBaseline:async()=> 'baseline',provision:async()=>{throw new Error('not used')},reintegrate:async()=>({applied_files:[]}),reconcile:async lease=>({disposition:'CLOSED',lease}),cleanup:async()=>{}}

test('runtime services resolve browser requirement through project-local operational-tool provisioning and durable smoke receipt',async()=>{
  const root=mkdtempSync(join(tempBase(),'hi-runtime-tool-')),previous=process.env.OPENCODE_HI_STATE_DIR
  process.env.OPENCODE_HI_STATE_DIR=join(root,'.runtime-state')
  let ready=false,bootstraps=0
  const implementationRoot=projectOperationalToolImplementationRoot(root,'browser-execution','playwright-chromium'),cachePath=join(implementationRoot,'1.62.1'),executable=join(cachePath,'chromium-1','chrome-linux','chrome')
  const browser={health:async()=>ready?({available:true,version:'playwright-core:1.62.1'}):({available:false,reason:'missing chromium'}),open:async()=>{throw new Error('not used')},navigate:async()=>{throw new Error('not used')},click:async()=>{throw new Error('not used')},type:async()=>{throw new Error('not used')},key:async()=>{throw new Error('not used')},inspect:async()=>{throw new Error('not used')},viewport:async()=>{throw new Error('not used')},screenshot:async()=>{throw new Error('not used')},wait:async()=>{throw new Error('not used')},close:async()=>{throw new Error('not used')},cleanup:async()=>({cleaned:false,reason:'not-found'})}
  try{
    const services=createRuntimeServices({ports:{nativeContext:{directory:root},childSession:makeChildSessionPort(),hostCapabilities:[],process:noopProcess,workspace:noopWorkspace,createBrowser:()=>browser,browserTool:{implementationId:'playwright-chromium',version:'1.62.1',cachePath,discover:()=>existsSync(executable)?executable:undefined},bootstrapBrowser:async()=>{bootstraps++;mkdirSync(join(cachePath,'chromium-1','chrome-linux'),{recursive:true});writeFileSync(executable,'browser');ready=true;return{available:true,attempted:true,cachePath,version:'1.62.1',executablePath:executable}}},projectRoot:root,packageRoot:root,getConfig:()=>DEFAULT_HI_CONFIG,getModels:()=>[],getHostConfig:()=>({})})
    const first=await services.ensureBrowserAvailable();assert.equal(first.available,true);assert.equal(first.status,'provisioned');assert.equal(first.scope,'project-local');assert.equal(bootstraps,1)
    const receiptPath=projectOperationalToolReceiptPath(root,'browser-execution','playwright-chromium');assert.equal(first.receiptPath,receiptPath);assert.equal(existsSync(receiptPath),true)
    const receipt=JSON.parse(readFileSync(receiptPath,'utf8'));assert.equal(receipt.dependency_class,'operational-tool');assert.equal(receipt.authority.source,'task-requirement');assert.equal(receipt.smoke.ok,true);assert.ok(receipt.executable_path.startsWith(implementationRoot))
    const second=await services.ensureBrowserAvailable();assert.equal(second.available,true);assert.equal(second.status,'cached');assert.equal(bootstraps,1)
    services.persistence.markCleanShutdown(services.store.all())
  }finally{
    if(previous===undefined)delete process.env.OPENCODE_HI_STATE_DIR;else process.env.OPENCODE_HI_STATE_DIR=previous
    rmSync(root,{recursive:true,force:true})
  }
})
