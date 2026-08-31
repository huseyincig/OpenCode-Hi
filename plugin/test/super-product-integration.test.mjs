import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {ProjectIntelligenceRuntime} from '../dist/runtime/project-intelligence/runtime.js'
import {ecosystemIntegrationView} from '../dist/runtime/ecosystem/runtime.js'
import {superProductIntegrationView} from '../dist/runtime/integration/super-product.js'
import {startAssessedMission} from './helpers/semantic.mjs'

function mission(){return startAssessedMission(new MissionStore(process.cwd()),'sp','integrate campaign c',{task_kind:'analysis',required_capabilities:['analysis']})}
const capability={id:'provider-inventory',host_id:'opencode',status:'SUPPORTED',verification_level:'OBSERVED',native_primitive:'provider.list',adapter_entrypoint:'host.getModels',semantic_loss:[],required_permissions:[],acceptance_ref:'provider-connected-inventory.test.mjs',forbidden_fake_behavior:'none'}
const evalView=()=>({claim_boundary:'evaluation-certification-composition-only',certification:{verdict:'NO_REGRESSION'}})

test('Super Product view composes Campaign-C layers from canonical inputs without acquiring ownership',()=>{
  const m=mission(),pi=new ProjectIntelligenceRuntime(process.cwd()),eco=ecosystemIntegrationView({hostCapabilities:[capability],hostConfig:{}}),evaluation=evalView()
  const view=superProductIntegrationView({mission:m,projectMissions:[m],liveInventory:[{id:'p/m',provider:'p',connected:true}],projectIntelligence:pi,ecosystem:eco,evaluation,projectRoot:process.cwd()})
  assert.equal(view.mission_id,m.identity.mission_id)
  assert.equal(view.project_intelligence.composition_owner,'ProjectIntelligenceRuntime')
  assert.equal(view.model_intelligence.inventory.source,'opencode-live')
  assert.equal(view.collaboration.claim_boundary,'projection-only')
  assert.equal(view.mission_ux.claim_boundary,'derived-from-canonical-runtime')
  assert.equal(view.observability_economics.claim_boundary,'derived-from-canonical-worker-usage+mission-ledger')
  assert.equal(view.ecosystem.claim_boundary,'derived-integration-composition-only')
  assert.equal(view.behavioral_evaluation.attached,true)
  assert.equal(view.behavioral_evaluation.verdict,'NO_REGRESSION')
  assert.equal(view.persistence_owner,'none-derived-integration-view')
  assert.equal(view.claim_boundary,'campaign-c-derived-composition-only')
  assert.deepEqual(view.ownership,{mission:'MissionStore',evidence:'EvidenceRuntime/VerificationEnvelope',authority:'AuthorityContract',routing:'RoutingPolicy',native:'OpenCode',usage:'Worker.usage_observations',context:'ContextArtifactStore',project_intelligence:'narrow-data-class-owners'})
})

test('Super Product view does not fabricate evaluation state during normal runtime composition',()=>{
  const m=mission(),view=superProductIntegrationView({mission:m,liveInventory:[],projectIntelligence:new ProjectIntelligenceRuntime(process.cwd()),ecosystem:ecosystemIntegrationView({hostCapabilities:[],hostConfig:{}})})
  assert.deepEqual(view.behavioral_evaluation,{mode:'explicit-receipt-driven',attached:false,authority:'evaluation-only'})
  for(const key of ['approve','complete','persist','route','write','execute'])assert.equal(key in view,false)
})
