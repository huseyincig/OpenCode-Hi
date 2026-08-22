import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {recommendInitialRoleModels,resolveModel} from '../dist/runtime/routing/model-resolver.js'

function project(){return mkdtempSync(join(tmpdir(),'hi-model-preview-'))}
function inventory(){return[
 {id:'alpha/general',provider:'alpha',tags:['coding','balanced'],quality:9,cost:.2,visionCapable:false,variants:['low','medium','high']},
 {id:'beta/fast',provider:'beta',tags:['fast'],quality:50,cost:.01,visionCapable:false,variants:['low']},
 {id:'vision/eye',provider:'vision',tags:['coding','reasoning'],quality:1,cost:20,visionCapable:true,variants:['medium','high']},
]}

test('automatic role recommendations are pure preview and never create project routing state',()=>{
 const p=project();try{
  const models=inventory(),cfg=structuredClone(DEFAULT_HI_CONFIG)
  const preview=recommendInitialRoleModels(models,cfg)
  assert.equal(preview.coder?.[0],'alpha/general')
  assert.equal(preview['visual-qa']?.[0],'vision/eye')
  assert.equal(existsSync(join(p,'.opencode','hi','policy','routing.json')),false)
  assert.deepEqual(cfg.routing.roleModels,DEFAULT_HI_CONFIG.routing.roleModels,'preview must not mutate user preference state')
 }finally{rmSync(p,{recursive:true,force:true})}
})

test('automatic preview cannot shadow an explicit persisted user role mapping',()=>{
 const p=project();try{
  mkdirSync(join(p,'.opencode','hi','policy'),{recursive:true})
  const file=join(p,'.opencode','hi','policy','routing.json')
  writeFileSync(file,JSON.stringify({schema:1,type:'hi-routing',routing:{modelPolicy:'manual',roleModels:{coder:['beta/fast']},adaptiveRoles:[]}},null,2)+'\n')
  const before=readFileSync(file,'utf8'),cfg=resolveHiConfig({},p),preview=recommendInitialRoleModels(inventory(),cfg)
  assert.equal(preview.coder?.[0],'beta/fast','preview respects the explicit role owner when asked to resolve that role')
  assert.equal(readFileSync(file,'utf8'),before,'preview must be read-only')
  assert.deepEqual(resolveHiConfig({},p).routing.roleModels.coder,['beta/fast'])
 }finally{rmSync(p,{recursive:true,force:true})}
})

test('manual role mapping persists exact fallback chain and model variants into runtime',()=>{
 const p=project();try{
  mkdirSync(join(p,'.opencode','hi','policy'),{recursive:true})
  writeFileSync(join(p,'.opencode','hi','policy','routing.json'),JSON.stringify({schema:1,type:'hi-routing',routing:{modelPolicy:'manual',adaptiveRoles:[],roleModels:{coder:['p/code','p/fallback']},roleVariants:{coder:{'p/code':'high','p/fallback':'medium'}}}},null,2)+'\n')
  const cfg=resolveHiConfig({},p)
  assert.deepEqual(cfg.routing.roleModels.coder,['p/code','p/fallback'])
  assert.equal(cfg.routing.roleVariants.coder['p/code'],'high')
  const r=resolveModel('standard',[{id:'p/code',provider:'p',tags:['coding'],variants:['low','high']},{id:'p/fallback',provider:'p',tags:['coding'],variants:['low','medium']}],cfg,undefined,'coder')
  assert.equal(r.primary,'p/code');assert.equal(r.primaryVariant,'high')
  assert.deepEqual(r.fallbacks,['p/fallback']);assert.equal(r.fallbackVariants['p/fallback'],'medium')
 }finally{rmSync(p,{recursive:true,force:true})}
})
