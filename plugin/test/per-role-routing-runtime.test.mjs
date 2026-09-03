import test from 'node:test'
import assert from 'node:assert/strict'
import {resolveModel,runtimeModelCandidateStatus} from '../dist/runtime/routing/model-resolver.js'
import {resolveHiConfig} from '../dist/config/resolver.js'

const INVENTORY=[
  {id:'p/fast',provider:'p',tags:['fast'],quality:99,cost:.01,variants:['low']},
  {id:'p/code',provider:'p',tags:['coding','balanced'],quality:2,cost:10,variants:['low','medium']},
  {id:'p/reason',provider:'p',tags:['reasoning','coding'],quality:3,cost:20,variants:['medium','high']},
  {id:'p/assured',provider:'p',tags:['high-assurance','reasoning','coding'],quality:1,cost:50,variants:['high','xhigh']},
]
const cfgWith=roleModels=>resolveHiConfig({routing:{roleModels}})

test('explicit ordered role mapping is authoritative and preserves eligible fallback order',()=>{
  const cfg=cfgWith({coder:['p/code','p/reason','p/fast']})
  const r=resolveModel('standard',INVENTORY,cfg,undefined,'coder',{})
  assert.equal(r.primary,'p/code')
  assert.deepEqual(r.fallbacks,['p/reason','p/fast'])
  assert.ok(r.reason.includes('explicit ordered role mapping:coder'))
  assert.deepEqual(r.fallbackReasons.map(x=>x.model),['p/reason','p/fast'])
})

test('ordered role mapping skips unavailable entries but never invents an unconfigured fallback',()=>{
  const cfg=cfgWith({coder:['p/missing','p/reason','p/code']})
  const r=resolveModel('standard',INVENTORY,cfg,undefined,'coder',{})
  assert.equal(r.primary,'p/reason')
  assert.deepEqual(r.fallbacks,['p/code'])
  assert.ok(r.reason.includes('role-mapped-model-unavailable-or-policy-rejected:p/missing'))
})

test('explicit role mapping with no eligible model fails closed',()=>{
  const cfg=cfgWith({coder:['p/missing']})
  const r=resolveModel('standard',INVENTORY,cfg,undefined,'coder',{})
  assert.equal(r.primary,undefined)
  assert.deepEqual(r.fallbacks,[])
  assert.ok(r.reason.includes('explicit role mapping has no eligible model:coder'))
})

test('explicit user role mapping outranks agent-supplied task model and host agent model',()=>{
  const cfg=cfgWith({coder:['p/code']})
  const host={agent:{coder:{model:'p/reason'}}}
  const r=resolveModel('standard',INVENTORY,cfg,'p/fast','coder',host)
  assert.equal(r.primary,'p/code')
  assert.ok(r.reason.includes('explicit ordered role mapping:coder'))
  assert.ok(r.reason.some(x=>x.includes('task model override ignored because explicit role mapping is authoritative:p/fast')))
})

test('unavailable agent-supplied task model cannot bypass an explicit user role mapping',()=>{
  const cfg=cfgWith({coder:['p/code']})
  const r=resolveModel('standard',INVENTORY,cfg,'p/missing','coder',{agent:{coder:{model:'p/reason'}}})
  assert.equal(r.primary,'p/code')
  assert.ok(r.reason.some(x=>x.includes('task model override ignored because explicit role mapping is authoritative:p/missing')))
})

test('OpenCode explicit agent model is the fallback owner when Hi has no role preference',()=>{
  const cfg=cfgWith({})
  const r=resolveModel('deep',INVENTORY,cfg,undefined,'coder',{agent:{coder:{model:'p/reason',variant:'high'}}})
  assert.equal(r.primary,'p/reason')
  assert.equal(r.primaryVariant,'high')
  assert.ok(r.reason.includes('OpenCode agent explicit model'))
})

test('Hi explicit role mapping outranks OpenCode agent model without mutating host choice',()=>{
  const cfg=cfgWith({coder:['p/code']})
  const host={agent:{coder:{model:'p/reason'}}}
  const r=resolveModel('standard',INVENTORY,cfg,undefined,'coder',host)
  assert.equal(r.primary,'p/code')
  assert.equal(host.agent.coder.model,'p/reason')
})

test('unavailable OpenCode explicit agent model fails closed instead of falling into automatic selection',()=>{
  const r=resolveModel('standard',INVENTORY,cfgWith({}),undefined,'coder',{agent:{coder:{model:'p/missing'}}})
  assert.equal(r.primary,undefined)
  assert.ok(r.reason.includes('OpenCode agent explicit model unavailable-or-policy-rejected:p/missing'))
})

test('automatic recommendation uses ordered capability priorities, not quality or cost',()=>{
  const r=resolveModel('critical',INVENTORY,cfgWith({}),undefined,'security-reviewer',{})
  assert.equal(r.primary,'p/assured','high-assurance must outrank cheaper/higher-quality metadata for critical work')
  assert.ok(r.reason.includes('capability-priority:high-assurance>reasoning>coding'))
  assert.ok(r.reason.includes('cost/quality/feedback are not routing authority'))
  assert.ok(r.reason.includes('not persisted as user preference'))
})

test('automatic recommendation uses explicit allowedModels order as the final tie-break after equal capability and variant fit',()=>{
  const inventory=[
    {id:'p/lower',provider:'p',writeCapable:true,tags:['coding','balanced'],variants:['medium']},
    {id:'p/preferred',provider:'p',writeCapable:true,tags:['coding','balanced'],variants:['medium']},
    {id:'p/third',provider:'p',writeCapable:true,tags:['coding','balanced'],variants:['medium']},
  ]
  const cfg=resolveHiConfig({routing:{allowedModels:['p/preferred','p/third','p/lower']}})
  const r=resolveModel('standard',inventory,cfg,undefined,'coder',{})
  assert.equal(r.primary,'p/preferred')
  assert.deepEqual(r.recoveryCandidates,['p/third','p/lower'])
  assert.ok(r.reason.includes('policy-order:allowedModels'))
})

test('automatic recommendation uses category-compatible variant fit as deterministic tie-break',()=>{
  const inventory=[
    {id:'p/a',provider:'p',tags:['reasoning','coding'],variants:['low']},
    {id:'p/b',provider:'p',tags:['reasoning','coding'],variants:['high']},
  ]
  const r=resolveModel('deep',inventory,cfgWith({}),undefined,'architect',{})
  assert.equal(r.primary,'p/b')
  assert.equal(r.primaryVariant,'high')
  assert.ok(r.reason.includes('variant-fit:high'))
})

test('mission feedback telemetry cannot reorder explicit mapping or automatic recommendation',()=>{
  const feedback={samples:{'p/code':8,'p/reason':8},confidence:{'p/code':'high','p/reason':'high'},failures:{'p/code':8},successes:{'p/reason':8},verification_failures:{'p/code':8},verification_passes:{'p/reason':8}}
  const explicit=resolveModel('standard',INVENTORY,cfgWith({coder:['p/code','p/reason']}),undefined,'coder',undefined,feedback)
  assert.equal(explicit.primary,'p/code');assert.deepEqual(explicit.fallbacks,['p/reason'])
  const automatic=resolveModel('deep',INVENTORY,cfgWith({}),undefined,'architect',undefined,feedback)
  assert.equal(automatic.primary,'p/reason')
  assert.ok(automatic.reason.includes('cost/quality/feedback are not routing authority'))
})

test('native provider deny is a hard eligibility filter before explicit role selection',()=>{
  const cfg=cfgWith({coder:['p/code']})
  const r=resolveModel('standard',INVENTORY,cfg,undefined,'coder',{disabled_providers:['p']})
  assert.equal(r.primary,undefined)
  assert.ok(r.rejected.some(x=>x.id==='p/code'&&x.reason==='host-provider-policy-deny:p'))
})

test('empty runtime inventory permits host-default only when no explicit model owner exists',()=>{
  assert.equal(resolveModel('standard',[],cfgWith({}),undefined,'coder',{}).primary,'host-default')
  assert.equal(resolveModel('standard',[],cfgWith({coder:['p/code']}),undefined,'coder',{}).primary,undefined)
  assert.equal(resolveModel('standard',[],cfgWith({}),'p/code','coder',{}).primary,undefined)
})

test('visual-qa requires proven image capability before every selection path',()=>{
  const inventory=[
    {id:'p/text',provider:'p',tags:['coding'],visionCapable:false},
    {id:'p/vision',provider:'p',tags:['coding'],visionCapable:true},
  ]
  const mapped=resolveModel('visual',inventory,cfgWith({'visual-qa':['p/text','p/vision']}),undefined,'visual-qa',{})
  assert.equal(mapped.primary,'p/vision')
  assert.ok(mapped.rejected.some(x=>x.id==='p/text'&&x.reason==='role-capability-missing:vision'))
  assert.equal(resolveModel('visual',[],cfgWith({}),undefined,'visual-qa',{}).primary,undefined)
})

test('read-only Hi child roles do not inherit coder write-capability requirements',()=>{
  const inventory=[
    {id:'p/read-only',provider:'p',tags:['reasoning','high-assurance'],writeCapable:false,visionCapable:true},
    {id:'p/writer',provider:'p',tags:['coding'],writeCapable:true,visionCapable:false},
  ]
  const architect=resolveModel('deep',inventory,cfgWith({architect:['p/read-only']}),undefined,'architect',{})
  assert.equal(architect.primary,'p/read-only')
  const review=resolveModel('critical',inventory,cfgWith({'qa-reviewer':['p/read-only']}),undefined,'qa-reviewer',{})
  assert.equal(review.primary,'p/read-only')
  const visual=resolveModel('visual',inventory,cfgWith({'visual-qa':['p/read-only']}),undefined,'visual-qa',{})
  assert.equal(visual.primary,'p/read-only','visual role still relies on proven vision capability, not repository write authority')
  assert.equal(runtimeModelCandidateStatus('p/read-only',inventory,cfgWith({}),{},'repository-explorer').ok,true)

  const coder=resolveModel('standard',inventory,cfgWith({coder:['p/read-only','p/writer']}),undefined,'coder',{})
  assert.equal(coder.primary,'p/writer')
  assert.ok(coder.rejected.some(x=>x.id==='p/read-only'&&x.reason==='not-write-capable'))
  assert.equal(runtimeModelCandidateStatus('p/read-only',inventory,cfgWith({}),{},'coder').ok,false)
  assert.equal(runtimeModelCandidateStatus('p/read-only',inventory,cfgWith({}),{}).ok,false,'legacy/unspecified role stays conservatively write-capable')
})

test('automatic recovery candidates retain category variant metadata without becoming routing fallbacks',()=>{
  const inventory=[
    {id:'p/primary',provider:'p',tags:['reasoning','coding'],variants:['high']},
    {id:'p/recovery',provider:'p',tags:['reasoning','coding'],variants:['low','high']},
  ]
  const r=resolveModel('deep',inventory,cfgWith({}),undefined,'architect',{})
  assert.equal(r.primary,'p/primary')
  assert.deepEqual(r.fallbacks,[])
  assert.deepEqual(r.recoveryCandidates,['p/recovery'])
  assert.equal(r.fallbackVariants['p/recovery'],'high')
})
