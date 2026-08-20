import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {ensureProjectRoutingConfig} from '../dist/config/auto-init.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {recommendInitialRoleModels,resolveModel} from '../dist/runtime/routing/model-resolver.js'

const ALL_CHILD_ROLES=['architect','coder','qa-reviewer','repository-explorer','security-reviewer','visual-qa']
function project(){return mkdtempSync(join(tmpdir(),'hi-model-setup-'))}
function inventory(){return[
 {id:'alpha/general',provider:'alpha',tags:['balanced','reasoning','coding','high-assurance'],quality:9,cost:.2,visionCapable:false,variants:['low','medium','high']},
 {id:'beta/economy',provider:'beta',tags:['balanced','fast','cheap'],quality:4,cost:.05,visionCapable:false,variants:['low','medium']},
 {id:'vision/eye',provider:'vision',tags:['balanced','reasoning','coding','high-assurance'],quality:8,cost:.3,visionCapable:true,variants:['medium','high']},
]}

test('M16 first runtime inventory ranks and persists data-driven initial recommendations for child roles',()=>{
 const p=project();try{
  const models=inventory(),recommendations=recommendInitialRoleModels(models,structuredClone(DEFAULT_HI_CONFIG));const r=ensureProjectRoutingConfig(p,recommendations);assert.equal(r.created,true);assert.equal(r.configuredRoles,6)
  const raw=JSON.parse(readFileSync(r.path,'utf8'));assert.equal(raw.routing.modelPolicy,'recommended');assert.deepEqual(raw.routing.adaptiveRoles,[]);assert.deepEqual(Object.keys(raw.routing.roleModels).sort(),ALL_CHILD_ROLES);assert.equal(raw.routing.roleModels.manager,undefined);assert.equal(raw.routing.roleModels['working-manager'],undefined)
  assert.equal(raw.routing.roleModels.coder[0],'alpha/general');assert.equal(raw.routing.roleModels['visual-qa'][0],'vision/eye')
  const cfg=resolveHiConfig({},p),coder=resolveModel('standard',models,cfg,undefined,'coder'),visual=resolveModel('visual',models,cfg,undefined,'visual-qa');assert.equal(coder.primary,'alpha/general');assert.equal(visual.primary,'vision/eye');assert.ok(coder.reason.some(x=>x.includes('configured-role-prior-fast-path')))
 }finally{rmSync(p,{recursive:true,force:true})}
})

test('M16 later user routing choice is preserved and automatic ranking does not overwrite it',()=>{
 const p=project();try{
  const models=inventory(),initial=recommendInitialRoleModels(models,structuredClone(DEFAULT_HI_CONFIG));const first=ensureProjectRoutingConfig(p,initial);const raw=JSON.parse(readFileSync(first.path,'utf8'));raw.routing.roleModels.coder=['beta/economy'];raw.routing.modelPolicy='manual';writeFileSync(first.path,JSON.stringify(raw,null,2)+'\n')
  const changedModels=models.map(m=>m.id==='vision/eye'?{...m,quality:50}:m),later=recommendInitialRoleModels(changedModels,structuredClone(DEFAULT_HI_CONFIG));const second=ensureProjectRoutingConfig(p,later);assert.equal(second.created,false)
  const cfg=resolveHiConfig({},p);assert.deepEqual(cfg.routing.roleModels.coder,['beta/economy']);const selected=resolveModel('standard',changedModels,cfg,undefined,'coder');assert.equal(selected.primary,'beta/economy')
 }finally{rmSync(p,{recursive:true,force:true})}
})

test('manual role mapping persists ordered fallback chain and per-model variants into runtime',()=>{
 const p=project();try{
  mkdirSync(join(p,'.opencode','hi','policy'),{recursive:true});writeFileSync(join(p,'.opencode','hi','policy','routing.json'),JSON.stringify({schema:1,type:'hi-routing',routing:{strategy:'quality',modelPolicy:'manual',adaptiveRoles:[],roleModels:{coder:['p/code','p/fallback']},roleVariants:{coder:{'p/code':'high','p/fallback':'medium'}}}},null,2))
  const cfg=resolveHiConfig({},p);assert.deepEqual(cfg.routing.roleModels.coder,['p/code','p/fallback']);assert.equal(cfg.routing.roleVariants.coder['p/code'],'high');assert.equal('modelPolicy' in cfg.routing,false);assert.equal('adaptiveRoles' in cfg.routing,false)
  const r=resolveModel('standard',[{id:'p/code',quality:8,variants:['low','high']},{id:'p/fallback',quality:7,variants:['low','medium']}],cfg,undefined,'coder')
  assert.equal(r.primary,'p/code');assert.equal(r.primaryVariant,'high');assert.deepEqual(r.fallbacks,['p/fallback']);assert.equal(r.fallbackVariants['p/fallback'],'medium')
 }finally{rmSync(p,{recursive:true,force:true})}
})
