import test from 'node:test'
import assert from 'node:assert/strict'
import {parseSemanticIntentAssessment} from '../dist/runtime/intent/semantic-assessment.js'
import {semanticRequestUnits,assertVerificationRequestTrace} from '../dist/runtime/intent/request-units.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {renderSemanticAssessmentGate} from '../dist/runtime/intent/semantic-assessment-gate.js'

const base={material:true,message_kind:'mission',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','visual-qa'],requested_external_actions:[],likely_verification:['visual-check'],user_verification:[],verification_ceiling:false,verification_cases:[],nonvisual_request_units:[],likely_targets:['index.html'],intent_signals:[],suppressed_intent_signals:[],constraint_atoms:[]}
const tracedCase=(patch={})=>({id:'vc_reload',subject:'theme survives reload',required_browser_actions:['navigate','inspect'],source_units:['ru1'],...patch})

test('visual semantic contract requires bounded explicit verification cases',()=>{
  assert.throws(()=>parseSemanticIntentAssessment({...base,verification_cases:[]}),/visual-check requires non-empty (?:top-level )?verification_cases/)
  assert.throws(()=>parseSemanticIntentAssessment({...base,verification_cases:[{id:'vc_reload',subject:'reload',required_browser_actions:['reload'],source_units:['ru1']}]}),/verification_cases\[0\]: required_browser_actions contains unsupported action: reload/)
  const x=parseSemanticIntentAssessment({...base,verification_cases:[tracedCase()]});assert.deepEqual(x.verification_cases[0].required_browser_actions,['navigate','inspect']);assert.deepEqual(x.verification_cases[0].source_units,['ru1'])
})

test('visual request trace deterministically rejects silent user-outcome undercoverage',()=>{
  const text=`Fix the UI.\n- Verify desktop + mobile.\n- Verify filter.\n- Verify accessibility names, focus visibility.`
  const units=semanticRequestUnits(text);assert.deepEqual(units.map(x=>x.text),['Fix the UI','Verify desktop','mobile','Verify filter','Verify accessibility names','focus visibility'])
  const under=parseSemanticIntentAssessment({...base,verification_cases:[
    {id:'vc_desktop',subject:'desktop',required_browser_actions:['viewport','inspect'],source_units:['ru2']},
    {id:'vc_mobile',subject:'mobile',required_browser_actions:['viewport','inspect'],source_units:['ru3']},
    {id:'vc_filter',subject:'filter',required_browser_actions:['click','inspect'],source_units:['ru4']},
  ],nonvisual_request_units:['ru1']})
  assert.throws(()=>assertVerificationRequestTrace(text,under),error=>/request trace incomplete; unclassified unit\(s\): ru5,ru6/.test(String(error))&&/ru5:"Verify accessibility names"/.test(String(error))&&/ru6:"focus visibility"/.test(String(error)))
  const complete=parseSemanticIntentAssessment({...base,verification_cases:[...under.verification_cases,{id:'vc_accessibility',subject:'accessible names and visible focus',required_browser_actions:['key','inspect'],source_units:['ru5','ru6']}],nonvisual_request_units:['ru1']})
  assert.doesNotThrow(()=>assertVerificationRequestTrace(text,complete))
})

test('request trace rejects unknown, overlapping and untraced visual ownership',()=>{
  const text='Repair UI.\n- Verify keyboard behavior.'
  const noSource=parseSemanticIntentAssessment({...base,verification_cases:[{id:'vc_keyboard',subject:'keyboard',required_browser_actions:['key','inspect']}],nonvisual_request_units:['ru1']})
  assert.throws(()=>assertVerificationRequestTrace(text,noSource),/requires source_units/)
  const overlap=parseSemanticIntentAssessment({...base,verification_cases:[{id:'vc_keyboard',subject:'keyboard',required_browser_actions:['key','inspect'],source_units:['ru2']}],nonvisual_request_units:['ru1','ru2']})
  assert.throws(()=>assertVerificationRequestTrace(text,overlap),/cannot be both visual and nonvisual: ru2/)
})

test('visual cases become canonical mission and verification obligation state with trace refs intact',()=>{
  const store=new MissionStore(process.cwd()),m=store.start('visual-cases','verify UI')
  const cases=[tracedCase()];store.applyInitialSemanticAssessment('visual-cases',parseSemanticIntentAssessment({...base,verification_cases:cases}))
  assert.deepEqual(m.identity.intent.verificationCases,cases);assert.deepEqual(m.execution.obligations.find(o=>o.kind==='verification')?.verificationCases,cases)
})

test('semantic assessment rejects nested visual_request_units instead of silently dropping canonical cases',()=>{
  const nested={...base,visual_request_units:[{id:'ru2',kind:'visual',subject:'mobile cards',verification_cases:[tracedCase()]}],verification_cases:[]}
  assert.throws(()=>parseSemanticIntentAssessment(nested),/unsupported semantic assessment key\(s\): visual_request_units.*top-level verification_cases\[\]/)
})

test('semantic assessment rejects object-shaped nonvisual_request_units with canonical RU-id guidance',()=>{
  const malformed={...base,verification_cases:[tracedCase()],nonvisual_request_units:[{id:'ru1',kind:'nonvisual',subject:'logic'}]}
  assert.throws(()=>parseSemanticIntentAssessment(malformed),/nonvisual_request_units must be an array of RU id strings/)
})

test('semantic gate teaches request-unit traceability and all-cases browser action coverage',()=>{
  const store=new MissionStore(process.cwd()),m=store.start('visual-gate','verify UI'),gate=renderSemanticAssessmentGate(m)
  assert.match(gate,/verification_cases/);assert.match(gate,/source_units:RU\[\]/);assert.match(gate,/nonvisual_request_units=RU\[\]/);assert.match(gate,/all RU classified/);assert.match(gate,/navigate\|click/);assert.match(gate,/reload=navigate\+inspect/)
})

test('duplicate verification case IDs fail semantic admission and resume may preserve current traced case set',()=>{
  const cases=[tracedCase()];assert.throws(()=>parseSemanticIntentAssessment({...base,verification_cases:[...cases,...cases]}),/ids must be unique/)
  const store=new MissionStore(process.cwd()),m=store.start('visual-resume-cases','verify UI');store.applyInitialSemanticAssessment('visual-resume-cases',parseSemanticIntentAssessment({...base,verification_cases:cases}));store.beginFollowupSemanticAssessment('visual-resume-cases','continue the same verification')
  const resume=parseSemanticIntentAssessment({...base,message_kind:'resume',verification_cases:[],nonvisual_request_units:[]});store.applyFollowupSemanticAssessment('visual-resume-cases',resume);assert.deepEqual(m.identity.intent.verificationCases,cases)
})


test('hi_intent_assess keeps incomplete visual request trace pending until corrected on the same revision',async()=>{
  const {mkdtempSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),HiPlugin=(await import('../dist/plugin.js')).default
  const root=mkdtempSync(join(tmpdir(),'hi-visual-trace-admission-')),client={app:{log:async()=>{}},provider:{list:async()=>({data:[]})},session:{}}
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client});await hooks.config({})
    const sid='visual-trace-admission',text='Fix the UI.\n- Verify desktop + mobile.\n- Verify accessibility names, focus visibility.'
    await hooks['chat.message']({sessionID:sid},{message:{role:'user'},parts:[{type:'text',text}]})
    const common={...base,ambiguity:'resolvable',likely_targets:[],nonvisual_request_units:['ru1']}
    const malformed={...common,nonvisual_request_units:['not-an-id'],verification_cases:[{id:'vc_keyboard_flow',subject:'keyboard flow',required_browser_actions:['key','inspect'],source_units:['ru2']}]}
    const malformedRejected=JSON.parse(String(await hooks.tool.hi_intent_assess.execute({revision:1,assessment_json:JSON.stringify(malformed)},{sessionID:sid})))
    assert.equal(malformedRejected.status,'INVALID_ASSESSMENT');assert.match(malformedRejected.error,/invalid nonvisual_request_units/);assert.match(malformedRejected.request_unit_challenge,/^request_units=ru1:/);assert.match(malformedRejected.request_unit_challenge,/ru4:"Verify accessibility names"/)
    const incomplete={...common,verification_cases:[
      {id:'vc_desktop',subject:'desktop',required_browser_actions:['viewport','inspect'],source_units:['ru2']},
      {id:'vc_mobile',subject:'mobile',required_browser_actions:['viewport','inspect'],source_units:['ru3']},
    ]}
    const rejected=JSON.parse(String(await hooks.tool.hi_intent_assess.execute({revision:1,assessment_json:JSON.stringify(incomplete)},{sessionID:sid})))
    assert.equal(rejected.status,'INVALID_ASSESSMENT');assert.match(rejected.error,/unclassified unit\(s\): ru4,ru5/);assert.match(rejected.error,/ru4:"Verify accessibility names"/);assert.match(rejected.request_unit_challenge,/ru5:"focus visibility"/)
    const corrected={...common,verification_cases:[...incomplete.verification_cases,{id:'vc_accessibility',subject:'accessible names and visible focus',required_browser_actions:['key','inspect'],source_units:['ru4','ru5']}]}
    const accepted=JSON.parse(String(await hooks.tool.hi_intent_assess.execute({revision:1,assessment_json:JSON.stringify(corrected)},{sessionID:sid})))
    assert.equal(accepted.status,'ASSESSED');assert.equal(accepted.revision,1)
    const ledger=JSON.parse(String(await hooks.tool.hi_ledger.execute({limit:100},{sessionID:sid})));const verify=ledger.obligations.find(o=>o.id==='o-verification');assert.ok(verify)
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})
