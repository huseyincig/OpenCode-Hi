import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {validateConfigOptionCatalog} from '../dist/contracts/config-option.js'
import {HI_CONFIG_OPTIONS,HI_CONFIG_DEFAULTS} from '../dist/generated/config-policy.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'

function sourceOptions(){
  const raw=JSON.parse(readFileSync(new URL('../../data/hi-config-options.json',import.meta.url),'utf8'))
  assert.equal(raw.schema,1);assert.equal(raw.type,'hi-config-option-catalog')
  return raw.options.map(x=>({id:x.id,path:x.path,classification:x.classification,type:x.type,defaultValue:x.default,owner:x.owner,sourceSurfaces:x.source_surfaces,precedenceOrder:x.precedence_order,validator:x.validator,safetySemantics:x.safety_semantics,behavioralAcceptanceRefs:x.behavioral_acceptance_refs,...('runtime_consumer'in x?{runtimeConsumer:x.runtime_consumer}:{}),...('executor_effect'in x?{executorEffect:x.executor_effect}:{}),...('diagnostic_consumer'in x?{diagnosticConsumer:x.diagnostic_consumer}:{}),...('diagnostic_effect'in x?{diagnosticEffect:x.diagnostic_effect}:{}),...('doctor_projection'in x?{doctorProjection:x.doctor_projection}:{})}))
}
function setPath(root,path,value){const parts=path.split('.');let cur=root;for(const part of parts.slice(0,-1))cur=cur[part]??={};cur[parts.at(-1)]=structuredClone(value)}

test('canonical ConfigOption catalog validates, covers every default leaf and owns DEFAULT_HI_CONFIG',()=>{
  const options=validateConfigOptionCatalog(sourceOptions())
  assert.deepEqual(options,structuredClone(HI_CONFIG_OPTIONS))
  assert.equal(options.filter(x=>x.classification==='runtime').length,22)
  assert.equal(options.filter(x=>x.classification==='diagnostic').length,2)
  assert.equal(options.filter(x=>x.classification==='schema-marker').length,1)
  const rebuilt={};for(const option of options)setPath(rebuilt,option.path,option.defaultValue)
  assert.deepEqual(rebuilt,structuredClone(HI_CONFIG_DEFAULTS))
  assert.deepEqual(DEFAULT_HI_CONFIG,structuredClone(HI_CONFIG_DEFAULTS))
  for(const option of options.filter(x=>x.classification==='runtime')){assert.ok(option.runtimeConsumer);assert.ok(option.executorEffect)}
  for(const option of options.filter(x=>x.classification!=='runtime')){assert.equal(option.runtimeConsumer,undefined);assert.equal(option.executorEffect,undefined);assert.ok(option.diagnosticConsumer);assert.ok(option.diagnosticEffect)}
})

test('ConfigOption contract rejects fake executor effects and duplicate semantic paths',()=>{
  const runtime=structuredClone(HI_CONFIG_OPTIONS.find(x=>x.classification==='runtime'));delete runtime.executorEffect
  assert.throws(()=>validateConfigOptionCatalog([runtime]),/runtime option requires runtimeConsumer and executorEffect/)
  const diagnostic=structuredClone(HI_CONFIG_OPTIONS.find(x=>x.classification==='diagnostic'));diagnostic.runtimeConsumer='fake.runtime';diagnostic.executorEffect='fake effect'
  assert.throws(()=>validateConfigOptionCatalog([diagnostic]),/non-runtime option cannot claim runtime executor effect/)
  const marker=structuredClone(HI_CONFIG_OPTIONS.find(x=>x.classification==='schema-marker'));delete marker.diagnosticEffect
  assert.throws(()=>validateConfigOptionCatalog([marker]),/diagnostic\/schema option requires diagnosticConsumer and diagnosticEffect/)
  const base=structuredClone(HI_CONFIG_OPTIONS[0]),duplicate={...structuredClone(HI_CONFIG_OPTIONS[1]),path:base.path}
  assert.throws(()=>validateConfigOptionCatalog([base,duplicate]),/duplicate path/)
})
