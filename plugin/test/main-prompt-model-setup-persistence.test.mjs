import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {DEFAULT_ROLE_MODELS_OPENCODE_GO,ensureProjectRoutingConfig} from '../dist/config/auto-init.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {resolveModel} from '../dist/runtime/routing/model-resolver.js'

const ALL=[...new Set(Object.values(DEFAULT_ROLE_MODELS_OPENCODE_GO).flat())]
function project(){return mkdtempSync(join(tmpdir(),'hi-model-setup-'))}

test('recommended setup persists only the 6 model-routed child roles when curated inventory is available',()=>{
 const p=project();try{
  const r=ensureProjectRoutingConfig(p,ALL);assert.equal(r.created,true);assert.equal(r.configuredRoles,6)
  const raw=JSON.parse(readFileSync(r.path,'utf8'));assert.equal(raw.routing.modelPolicy,'recommended');assert.deepEqual(raw.routing.adaptiveRoles,[]);assert.equal(Object.keys(raw.routing.roleModels).length,6);assert.equal(raw.routing.roleModels.manager,undefined);assert.equal(raw.routing.roleModels['working-manager'],undefined)
  const first=resolveHiConfig({},p),second=resolveHiConfig({},p);assert.deepEqual(second.routing.roleModels,first.routing.roleModels);assert.equal('modelPolicy' in second.routing,false);assert.equal('adaptiveRoles' in second.routing,false)
 }finally{rmSync(p,{recursive:true,force:true})}
})

test('recommended setup marks only unavailable roles for smart select without reranking configured roles',()=>{
 const p=project();try{
  const missing='visual-qa',live=ALL.filter(x=>!DEFAULT_ROLE_MODELS_OPENCODE_GO[missing].includes(x));const r=ensureProjectRoutingConfig(p,live)
  const raw=JSON.parse(readFileSync(r.path,'utf8'));assert.deepEqual(raw.routing.adaptiveRoles,[missing]);assert.ok(raw.routing.roleModels.coder);assert.equal(raw.routing.roleModels[missing],undefined)
  const cfg=resolveHiConfig({},p);const inventory=live.map(id=>({id,quality:5,variants:['low','medium','high']})).concat([{id:'other/visual',quality:9,tags:['vision','coding'],variants:['high']}])
  const coder=resolveModel('standard',inventory,cfg,undefined,'coder');assert.ok(coder.reason.some(x=>x.includes('recommended-fast-path')))
  const visual=resolveModel('visual',inventory,cfg,undefined,missing);assert.equal(visual.primary,'other/visual');assert.ok(!visual.reason.some(x=>x.includes('recommended-fast-path')))
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
