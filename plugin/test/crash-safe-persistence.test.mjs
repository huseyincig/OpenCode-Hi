import test from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,rmSync,existsSync,writeFileSync,readdirSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {RuntimePersistence} from '../dist/runtime/state/persistence.js'
import {acquireHiRuntimeInstance} from '../dist/opencode/instance-guard.js'

function childWriter(projectRoot,stateRoot,iterations=160){
  const code=`import {RuntimePersistence} from './dist/runtime/state/persistence.js';const p=new RuntimePersistence(process.env.M26_PROJECT_ROOT);for(let i=0;i<${iterations};i++)p.save([],false)`
  return new Promise((resolve)=>{
    const child=spawn(process.execPath,['--input-type=module','-e',code],{cwd:process.cwd(),env:{...process.env,M26_PROJECT_ROOT:projectRoot,OPENCODE_HI_STATE_DIR:stateRoot},stdio:['ignore','pipe','pipe']})
    let stderr='';child.stderr.on('data',chunk=>{stderr+=String(chunk)});child.on('close',code=>resolve({code,stderr}))
  })
}

test('M26 concurrent snapshot writers never collide through a shared temporary pathname',async()=>{
  const root=mkdtempSync(join(process.env.TMPDIR??tmpdir(),'hi-m26-writers-'))
  try{
    const stateRoot=join(root,'state'),runs=await Promise.all(Array.from({length:8},()=>childWriter(root,stateRoot)))
    assert.deepEqual(runs.map(x=>x.code),Array(8).fill(0),runs.map(x=>x.stderr).filter(Boolean).join('\n'))
    const prior=process.env.OPENCODE_HI_STATE_DIR;process.env.OPENCODE_HI_STATE_DIR=stateRoot
    try{const persistence=new RuntimePersistence(root);assert.deepEqual(persistence.load(),[]);assert.equal(persistence.lastLoadReport.error,undefined)}finally{prior===undefined?delete process.env.OPENCODE_HI_STATE_DIR:process.env.OPENCODE_HI_STATE_DIR=prior}
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('M26 runtime instance guard fences distinct owners that share one persistent writer lease',()=>{
  const root=mkdtempSync(join(process.env.TMPDIR??tmpdir(),'hi-m26-lease-')),lockPath=join(root,'runtime-instance.lock')
  try{
    const first=acquireHiRuntimeInstance('same-project',{}, {lockPath})
    try{assert.throws(()=>acquireHiRuntimeInstance('same-project',{}, {lockPath}),/Duplicate OpenCode-Hi runtime|runtime writer/i)}finally{first.release()}
    assert.equal(existsSync(lockPath),false)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('M26 persistent writer lease fences a second live Node process',async()=>{
  const root=mkdtempSync(join(process.env.TMPDIR??tmpdir(),'hi-m26-process-lease-')),lockPath=join(root,'runtime-instance.lock')
  try{
    const holderCode=`import {acquireHiRuntimeInstance} from './dist/opencode/instance-guard.js';const l=acquireHiRuntimeInstance('shared-project',{}, {lockPath:process.env.M26_LOCK});console.log('READY');setTimeout(()=>{l.release()},1200)`
    const holder=spawn(process.execPath,['--input-type=module','-e',holderCode],{cwd:process.cwd(),env:{...process.env,M26_LOCK:lockPath},stdio:['ignore','pipe','pipe']})
    await new Promise((resolve,reject)=>{let stderr='';holder.stderr.on('data',c=>{stderr+=String(c)});holder.stdout.on('data',c=>{if(String(c).includes('READY'))resolve()});holder.once('error',reject);holder.once('close',code=>{if(code!==0)reject(new Error(stderr||`holder exited ${code}`))})})
    const contenderCode=`import {acquireHiRuntimeInstance} from './dist/opencode/instance-guard.js';try{const l=acquireHiRuntimeInstance('shared-project',{}, {lockPath:process.env.M26_LOCK});l.release();process.exit(0)}catch(e){console.error(String(e));process.exit(23)}`
    const outcome=await new Promise(resolve=>{const child=spawn(process.execPath,['--input-type=module','-e',contenderCode],{cwd:process.cwd(),env:{...process.env,M26_LOCK:lockPath},stdio:['ignore','ignore','pipe']});let stderr='';child.stderr.on('data',c=>{stderr+=String(c)});child.on('close',code=>resolve({code,stderr}))})
    assert.equal(outcome.code,23,outcome.stderr)
    assert.match(outcome.stderr,/Duplicate OpenCode-Hi runtime writer/)
    await new Promise(resolve=>holder.once('close',resolve))
    assert.equal(existsSync(lockPath),false)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('M26 dead-owner runtime lease is quarantined before safe recovery',()=>{
  const root=mkdtempSync(join(process.env.TMPDIR??tmpdir(),'hi-m26-stale-lease-')),lockPath=join(root,'runtime-instance.lock')
  try{
    writeFileSync(lockPath,JSON.stringify({schema:1,pid:2147483647,token:'dead-owner',started_at:Date.now()-10000})+'\n')
    const lease=acquireHiRuntimeInstance('stale-project',{}, {lockPath})
    try{assert.equal(existsSync(lockPath),true);assert.equal(readdirSync(root).some(x=>x.includes('.stale.')),false)}finally{lease.release()}
    assert.equal(existsSync(lockPath),false)
  }finally{rmSync(root,{recursive:true,force:true})}
})
