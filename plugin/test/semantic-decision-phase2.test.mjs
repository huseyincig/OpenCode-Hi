import test from 'node:test'
import assert from 'node:assert/strict'
import { decideSemanticExecution } from '../dist/runtime/decision/semantic-decision.js'
import { renderSemanticAssessmentGate } from '../dist/runtime/intent/semantic-assessment-gate.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { HI_METHODOLOGY_SIGNAL_CATALOG } from '../dist/generated/methodology-policy.js'
import { SEMANTIC_CAPABILITIES,SEMANTIC_EXTERNAL_ACTIONS,SEMANTIC_VERIFICATION_KINDS } from '../dist/runtime/intent/semantic-assessment.js'

const topology={mode:'adaptive',maxAgents:4,parallelism:2}
const verification=(requireReview=false)=>({requiredKinds:['targeted-tests'],requireFresh:true,requireReview,allowWorkerReportedEvidence:!requireReview})
const intent=(patch={})=>({
  objective:'bounded task',taskKind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependencyClass:'independent',
  requiredCapabilities:['implementation'],requestedExternalActions:[],likelyVerification:['targeted-tests'],likelyTargets:['src/a.ts'],avoid:[],...patch,
})

test('Phase 2 decision envelope keeps clear local implementation direct and zero-child',()=>{
  const d=decideSemanticExecution({intent:intent(),verification:verification(),primaryMode:'working-manager',topology})
  assert.equal(d.version,1)
  assert.equal(d.executionPath,'DIRECT')
  assert.equal(d.topology.mode,'single-agent')
  assert.equal(d.topology.parallelism,1)
  assert.equal(d.teamDirect,true)
  assert.deepEqual(d.childRoles,[])
  assert.equal(d.modelClass,'quick')
  assert.equal(d.assurance.freshReviewerRequired,false)
  assert.equal(d.isolation.intent,'NONE')
  assert.equal(d.providerSurfacePhase,'DIRECT_CONTROL')
})

test('Phase 2 decision envelope keeps material uncertainty evidence-first without fabricating isolation',()=>{
  const d=decideSemanticExecution({intent:intent({taskKind:'bug-fix',risk:'medium',ambiguity:'resolvable',requiredCapabilities:['implementation','repository-analysis','source-verification']}),verification:verification(),primaryMode:'working-manager',topology})
  assert.equal(d.executionPath,'EVIDENCE')
  assert.equal(d.providerSurfacePhase,'EVIDENCE_CONTROL')
  assert.equal(d.capabilities.sourceWeb,true)
  assert.equal(d.capabilities.repository,true)
  assert.equal(d.isolation.intent,'NONE')
})

test('Phase 2 decision envelope marks multi-stream write isolation only as an exact-task candidate',()=>{
  const d=decideSemanticExecution({intent:intent({scope:'multi-stream',dependencyClass:'independent-multi',requiredCapabilities:['implementation','multi-stream-delegation']}),verification:verification(),primaryMode:'working-manager',topology})
  assert.equal(d.executionPath,'PLANNED')
  assert.equal(d.topology.mode,'multi-agent')
  assert.ok(d.topology.parallelism>=2)
  assert.equal(d.isolation.intent,'CANDIDATE')
  assert.equal(d.capabilities.workspaceIsolationCandidate,true)
  assert.match(d.isolation.reason.join(' '),/exact-task.*before provisioning/i)
})

test('Phase 2 decision envelope preserves high-risk fresh-review escalation',()=>{
  const d=decideSemanticExecution({intent:intent({risk:'high',requiredCapabilities:['implementation','security-review']}),verification:verification(true),primaryMode:'working-manager',topology})
  assert.equal(d.executionPath,'ESCALATED')
  assert.equal(d.modelClass,'critical')
  assert.equal(d.assurance.freshReviewerRequired,true)
  assert.equal(d.providerSurfacePhase,'ESCALATED_CONTROL')
})

test('authority boundary stays non-speculative and critical',()=>{
  const d=decideSemanticExecution({intent:intent({risk:'authority-boundary',scope:'external',requestedExternalActions:['git-push']}),verification:verification(),primaryMode:'working-manager',topology})
  assert.equal(d.executionPath,'ESCALATED')
  assert.equal(d.topology.executionMode,'single')
  assert.equal(d.topology.mode,'single-agent')
  assert.equal(d.modelClass,'critical')
})

test('visual capability is represented as browser intent without claiming runtime availability',()=>{
  const d=decideSemanticExecution({intent:intent({taskKind:'review',scope:'multi-file',requiredCapabilities:['review','visual-qa']}),verification:verification(),primaryMode:'working-manager',topology})
  assert.equal(d.modelClass,'visual')
  assert.equal(d.capabilities.browser,true)
  assert.equal(d.capabilities.process,false,'current semantic contract must not fabricate a process requirement')
  assert.ok(d.capabilities.required.includes('visual-qa'))
  assert.equal(Object.hasOwn(d.capabilities,'available'),false)
})

test('compact semantic entry gate preserves closed contract and is at least 30 percent smaller',()=>{
  const store=new MissionStore(process.cwd()),m=store.start('phase2-gate','opaque multilingual task')
  const gate=renderSemanticAssessmentGate(m),legacyChars=2666,maxChars=Math.floor(legacyChars*0.70)
  assert.ok(gate.length<=maxChars,`gate=${gate.length}, maximum=${maxChars}`)
  assert.match(gate,/Hi SEMANTIC ASSESSMENT GATE/)
  assert.match(gate,/call hi_intent_assess exactly once/)
  assert.match(gate,/user language/)
  assert.match(gate,/scope and dependency_class describe material implementation\/change work units/)
  assert.match(gate,/test files that the user says must remain unchanged/)
  assert.match(gate,/one implementation change followed by verification is not a sequential dependency/)
  assert.match(gate,/T=implementation\|bug-fix\|diagnosis\|review/);assert.match(gate,/diagnosis is read-only root cause\/no fix/);assert.match(gate,/otherwise intent\.debugging requires material diagnosis \+ repository-analysis/)
  assert.match(gate,/requested_external_actions\(X\[\]\)/);assert.match(gate,/R=low\|medium\|high\|authority-boundary/);assert.match(gate,/X nonempty=>R=authority-boundary/)
  for(const value of [...SEMANTIC_CAPABILITIES,...SEMANTIC_EXTERNAL_ACTIONS,...SEMANTIC_VERIFICATION_KINDS])assert.ok(gate.includes(value),`missing closed enum ${value}`)
  assert.match(gate,/intent_signals=\[\] by default/);assert.match(gate,/intent\.<slug>/);assert.match(gate,/intent\.tdd/);assert.match(gate,/unknown signals reject/)
  const allowedIntentSignals=Object.entries(HI_METHODOLOGY_SIGNAL_CATALOG).filter(([name,spec])=>name.startsWith('intent.')&&spec.producers.includes('intent'));assert.ok(allowedIntentSignals.length>20,'parser-side closed intent signal catalog remains available without prompt duplication')
})

test('MissionStore consumes the decision envelope without creating a second durable decision owner',()=>{
  const store=new MissionStore(process.cwd()),m=store.start('phase2-store','opaque local implementation')
  store.applyInitialSemanticAssessment('phase2-store',{material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:['src/a.ts'],intent_signals:[],suppressed_intent_signals:[]})
  assert.equal(m.execution.adaptive_execution.path,'DIRECT')
  assert.equal(m.execution.topology.mode,'single-agent')
  assert.equal(Object.hasOwn(m.execution,'semantic_decision'),false)
  const event=m.execution.ledger.findLast(x=>x.type==='semantic.decision')
  assert.ok(event)
  assert.equal(event.payload.path,'DIRECT')
  assert.equal(event.payload.model_class,'quick')
})
