import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { inspectProject } from '../dist/doctor/project-inspection.js'
import { RuntimePersistence } from '../dist/runtime/state/persistence.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { runtimeStatePath } from '../dist/runtime/storage/locations.js'

const sha=s=>createHash('sha256').update(s).digest('hex')

test('doctor detects config drift from canonical ownership schema',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-own-'))
  try{
    mkdirSync(join(root,'.opencode','hi','provenance'),{recursive:true})
    const before=JSON.stringify({plugin:['opencode-hi@x']},null,2)+'\n'
    writeFileSync(join(root,'opencode.json'),before)
    writeFileSync(join(root,'.opencode','hi','provenance','setup.json'),JSON.stringify({schema:2,managed:{config:{after_sha256:sha(before),plugin_spec:'opencode-hi@x'}}}))
    assert.equal(inspectProject(root).configDrift,false)
    writeFileSync(join(root,'opencode.json'),JSON.stringify({plugin:['opencode-hi@x'],share:'manual'},null,2)+'\n')
    assert.equal(inspectProject(root).configDrift,true)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('runtime persistence loads and saves only the current canonical schema',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-state-'))
  try{
    const p=new RuntimePersistence(root)
    const mission=new MissionStore(root).start('s1','current mission')
    p.save([mission],true)
    const loaded=p.load()
    assert.equal(loaded.length,1);assert.equal(p.lastLoadReport.sourceSchema,7);assert.equal('migrated' in p.lastLoadReport,false)
    assert.equal(JSON.parse(readFileSync(p.path,'utf8')).schema,7)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('doctor marks unsupported runtime schema invalid',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-state-bad-'))
  try{
    const path=runtimeStatePath(root);mkdirSync(join(path,'..'),{recursive:true})
    writeFileSync(path,JSON.stringify({schema:99,missions:[]}))
    const p=inspectProject(root);assert.equal(p.runtimeState,'invalid');assert.equal(p.runtimeSchemaValid,false)
  }finally{rmSync(root,{recursive:true,force:true})}
})

import { runDoctor } from '../dist/doctor/checks.js'

test('doctor fails unsupported ownership schema',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-own-bad-'))
  try{mkdirSync(join(root,'.opencode','hi','provenance'),{recursive:true});writeFileSync(join(root,'.opencode','hi','provenance','setup.json'),JSON.stringify({schema:99}));const p=inspectProject(root);assert.equal(p.ownershipState,'invalid');assert.equal(p.ownershipSchemaValid,false)}finally{rmSync(root,{recursive:true,force:true})}
})

test('doctor flags role mapping with no runtime-available candidate',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-map-bad-'))
  try{
    const cfg={schemaVersion:2,executionPolicy:'adaptive',primaryMode:'auto',compatibility:{mode:'compatible',validatedOpenCodeVersions:[]},routing:{strategy:'cost-quality',categoryModels:{},categoryVariants:{},roleModels:{coder:['p/missing']},roleVariants:{},maxFallbacks:3,allowedProviders:[],deniedModels:[]},parallel:{enabled:true,max:3,providers:{},models:{}},teamMode:{enabled:false,maxMembers:4,maxWallMinutes:45},profile:{minimal:{specialistThreshold:'high',reviewThreshold:'low'},balanced:{specialistThreshold:'medium',reviewThreshold:'medium'},thorough:{specialistThreshold:'low',reviewThreshold:'high'}}}
    const c=runDoctor(cfg,new MissionStore(),root,{models:[{id:'p/available',provider:'p',tags:[]}]})
    const v=c.find(x=>x.id==='model-mapping-validity');assert.equal(v.status,'fail');assert.match(v.detail,/role:coder/)
  }finally{rmSync(root,{recursive:true,force:true})}
})
