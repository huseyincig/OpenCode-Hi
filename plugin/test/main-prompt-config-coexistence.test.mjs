import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runDoctor } from '../dist/doctor/checks.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { DEFAULT_HHC_CONFIG } from '../dist/config/defaults.js'

function root(){return mkdtempSync(join(tmpdir(),'oho-coexist-'))}

test('effective global HHC registration satisfies project registration when project config omits plugin',()=>{
  const r=root()
  try{
    writeFileSync(join(r,'opencode.json'),JSON.stringify({share:'manual'}))
    const checks=runDoctor(DEFAULT_HHC_CONFIG,new MissionStore(),r,{hostConfig:{plugin:['opencode-hhc-orchestrator@global','other-plugin@x']}})
    assert.equal(checks.find(x=>x.id==='plugin-registration')?.status,'pass')
    assert.equal(checks.find(x=>x.id==='effective-plugin-registration')?.status,'pass')
    assert.equal(checks.find(x=>x.id==='duplicate-hhc-plugin')?.status,'pass')
  }finally{rmSync(r,{recursive:true,force:true})}
})

test('doctor reports effective registration drift when plugin runtime is initialized but effective config has no HHC source',()=>{
  const r=root()
  try{
    writeFileSync(join(r,'opencode.json'),JSON.stringify({plugin:['other-plugin@x']}))
    const checks=runDoctor(DEFAULT_HHC_CONFIG,new MissionStore(),r,{hostConfig:{plugin:['other-plugin@x']}})
    const drift=checks.find(x=>x.id==='effective-plugin-registration')
    assert.equal(drift?.status,'fail')
    assert.equal(drift?.machine_status,'action-required')
  }finally{rmSync(r,{recursive:true,force:true})}
})

test('installed effective HHC plus project-local HHC plugin is a duplicate registration',()=>{
  const r=root()
  try{
    mkdirSync(join(r,'.opencode','plugins'),{recursive:true})
    writeFileSync(join(r,'.opencode','plugins','hhc-local.ts'),'export default {}')
    const checks=runDoctor(DEFAULT_HHC_CONFIG,new MissionStore(),r,{hostConfig:{plugin:['opencode-hhc-orchestrator@installed']}})
    assert.equal(checks.find(x=>x.id==='duplicate-hhc-plugin')?.status,'fail')
  }finally{rmSync(r,{recursive:true,force:true})}
})

test('doctor surfaces project/effective HHC spec shadowing as ownership drift',()=>{
  const r=root()
  try{
    mkdirSync(join(r,'.opencode'),{recursive:true})
    const projectSpec='opencode-hhc-orchestrator@project-pin'
    writeFileSync(join(r,'opencode.json'),JSON.stringify({plugin:[projectSpec]}))
    writeFileSync(join(r,'.opencode','oho-setup.json'),JSON.stringify({schema:2,managed:{config:{plugin_spec:projectSpec,after_sha256:'not-relevant-for-this-test'}}}))
    const checks=runDoctor(DEFAULT_HHC_CONFIG,new MissionStore(),r,{hostConfig:{plugin:['opencode-hhc-orchestrator@global-pin']}})
    const drift=checks.find(x=>x.id==='plugin-layer-drift')
    assert.equal(drift?.status,'fail')
    assert.equal(drift?.machine_status,'action-required')
  }finally{rmSync(r,{recursive:true,force:true})}
})
