import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { inspectProject } from '../dist/doctor/project-inspection.js'
import { RuntimePersistence } from '../dist/runtime/state/persistence.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'

const sha=s=>createHash('sha256').update(s).digest('hex')

test('doctor detects config drift from legacy flat ownership schema',()=>{
  const root=mkdtempSync(join(tmpdir(),'oho-own-'))
  try{
    mkdirSync(join(root,'.opencode'),{recursive:true})
    const before=JSON.stringify({plugin:['opencode-hhc-orchestrator@x']},null,2)+'\n'
    writeFileSync(join(root,'opencode.json'),before)
    writeFileSync(join(root,'.opencode','oho-setup.json'),JSON.stringify({schema:1,after_sha256:sha(before),plugin_spec:'opencode-hhc-orchestrator@x'}))
    assert.equal(inspectProject(root).configDrift,false)
    writeFileSync(join(root,'opencode.json'),JSON.stringify({plugin:['opencode-hhc-orchestrator@x'],share:'manual'},null,2)+'\n')
    assert.equal(inspectProject(root).configDrift,true)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('runtime persistence migrates schema 2 missions on load and saves schema 3',()=>{
  const root=mkdtempSync(join(tmpdir(),'oho-state-'))
  try{
    const dir=join(root,'.opencode','.oho');mkdirSync(dir,{recursive:true})
    const mission=new MissionStore(root).start('s1','legacy mission')
    writeFileSync(join(dir,'runtime-state.json'),JSON.stringify({schema:2,updated_at:1,missions:[mission]}))
    const p=new RuntimePersistence(root);const loaded=p.load()
    assert.equal(loaded.length,1);assert.equal(p.lastLoadReport.migrated,true);assert.equal(p.lastLoadReport.sourceSchema,2)
    p.save(loaded,true)
    assert.equal(JSON.parse(readFileSync(join(dir,'runtime-state.json'),'utf8')).schema,3)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('doctor marks unsupported runtime schema invalid',()=>{
  const root=mkdtempSync(join(tmpdir(),'oho-state-bad-'))
  try{
    const dir=join(root,'.opencode','.oho');mkdirSync(dir,{recursive:true})
    writeFileSync(join(dir,'runtime-state.json'),JSON.stringify({schema:99,missions:[]}))
    const p=inspectProject(root);assert.equal(p.runtimeState,'invalid');assert.equal(p.runtimeSchemaValid,false)
  }finally{rmSync(root,{recursive:true,force:true})}
})

import { runDoctor } from '../dist/doctor/checks.js'

test('doctor fails unsupported ownership schema',()=>{
  const root=mkdtempSync(join(tmpdir(),'oho-own-bad-'))
  try{mkdirSync(join(root,'.opencode'),{recursive:true});writeFileSync(join(root,'.opencode','oho-setup.json'),JSON.stringify({schema:99}));const p=inspectProject(root);assert.equal(p.ownershipState,'invalid');assert.equal(p.ownershipSchemaValid,false)}finally{rmSync(root,{recursive:true,force:true})}
})

test('doctor flags role mapping with no runtime-available candidate',()=>{
  const root=mkdtempSync(join(tmpdir(),'oho-map-bad-'))
  try{
    const cfg={schemaVersion:2,autonomy:'smart',primaryMode:'auto',compatibility:{mode:'compatible',validatedOpenCodeVersions:[]},routing:{strategy:'cost-quality',categoryModels:{},categoryVariants:{},roleModels:{coder:['p/missing']},roleVariants:{},modelPolicy:'smart-select',smartSelectRoles:[],maxFallbacks:3,allowedProviders:[],deniedModels:[]},parallel:{enabled:true,max:3,providers:{},models:{}},teamMode:{enabled:false,auto:false,maxMembers:4,maxMessages:24,maxTurns:12,maxWallMinutes:45},profile:{basic:{specialistThreshold:'high',parallelThreshold:'high',reviewThreshold:'low',costSensitivity:'high',qualityFloor:'standard'},standard:{specialistThreshold:'medium',parallelThreshold:'medium',reviewThreshold:'medium',costSensitivity:'medium',qualityFloor:'standard'},powerful:{specialistThreshold:'low',parallelThreshold:'low',reviewThreshold:'high',costSensitivity:'low',qualityFloor:'high'}}}
    const c=runDoctor(cfg,new MissionStore(),root,{models:[{id:'p/available',provider:'p',tags:[]}]})
    const v=c.find(x=>x.id==='model-mapping-validity');assert.equal(v.status,'fail');assert.match(v.detail,/role:coder/)
  }finally{rmSync(root,{recursive:true,force:true})}
})
