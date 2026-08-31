import test from 'node:test'
import assert from 'node:assert/strict'
import {ecosystemIntegrationView} from '../dist/runtime/ecosystem/runtime.js'

const supported={id:'provider-inventory',host_id:'opencode',status:'SUPPORTED',verification_level:'OBSERVED',native_primitive:'provider.list',adapter_entrypoint:'host.getModels',semantic_loss:[],required_permissions:[],acceptance_ref:'provider-connected-inventory.test.mjs',forbidden_fake_behavior:'none'}
const degraded={id:'session-status',host_id:'opencode',status:'DEGRADED',verification_level:'OBSERVED',fallback:'runtime-owned-state',semantic_loss:['native status unavailable'],required_permissions:[],acceptance_ref:'forensic-hardening.test.mjs',forbidden_fake_behavior:'none'}
const unsupported={id:'structured-human-decision-transport',host_id:'opencode',status:'UNSUPPORTED',verification_level:'OBSERVED',semantic_loss:[],required_permissions:[],acceptance_ref:'structured-human-decision-host.test.mjs',forbidden_fake_behavior:'none'}

function receipt(){return{schema:1,capability:'browser-execution',implementation_id:'playwright-chromium',dependency_class:'operational-tool',status:'cached',scope:'project-local',discovery_source:'project-local-cache',executable_path:'/sensitive/tool/path',project_tool_root:'/sensitive/tool/root',authority:{source:'task-requirement',ref:'private-authority-ref'},smoke:{ok:true,checked_at:10,detail:'private smoke detail'},receipt_path:'/sensitive/receipt.json',observed_at:11}}

test('ecosystem integration view composes existing owners without copying secrets, executable paths or authority payloads',()=>{
  const hostConfig={mcp:{github:{enabled:true,url:'https://secret.invalid',headers:{Authorization:'secret-token'}},browser:{enabled:true},disabled:{enabled:false}},provider:{secret:'never-project'}}
  const view=ecosystemIntegrationView({hostCapabilities:[unsupported,supported,degraded],hostConfig,selectedMcpServers:['github'],operationalToolReceipts:[receipt()]})
  assert.deepEqual(view.mcp.configured,['browser','github'])
  assert.deepEqual(view.mcp.selected,['github'])
  assert.deepEqual(view.mcp.disabled_patterns,['browser_*'])
  assert.deepEqual(view.degradation,{unsupported:['structured-human-decision-transport'],degraded:['session-status']})
  assert.equal(view.native_host.source,'HostCapabilityContract/opencode-live')
  assert.equal(view.operational_tools.receipts[0].smoke_ok,true)
  assert.equal(view.persistence_owner,'none-derived-view')
  assert.equal(view.claim_boundary,'derived-integration-composition-only')
  assert.equal(view.boundaries.native_owner,'OpenCode host/provider/session/runtime')
  assert.equal(view.boundaries.authority_owner,'AuthorityContract/ExternalAction runtime')
  assert.equal(view.boundaries.transport_ack,'observation-only-until-owning-contract-reconciliation')
  const serialized=JSON.stringify(view)
  for(const forbidden of ['secret-token','https://secret.invalid','/sensitive/','private-authority-ref','private smoke detail'])assert.equal(serialized.includes(forbidden),false,forbidden)
})

test('ecosystem integration view preserves native MCP fail-closed selection instead of inventing an integration',()=>{
  assert.throws(()=>ecosystemIntegrationView({hostCapabilities:[supported],hostConfig:{mcp:{github:{enabled:true}}},selectedMcpServers:['missing']}),/Requested MCP server\(s\) unavailable: missing/)
})

test('ecosystem integration view is a projection, not an integration control plane',()=>{
  const view=ecosystemIntegrationView({hostCapabilities:[supported],hostConfig:{}})
  for(const key of ['approve','complete','install','register','persist','execute','write'])assert.equal(key in view,false)
  assert.deepEqual(view.operational_tools.receipts,[])
  assert.deepEqual(view.mcp,{source:'opencode-native-config-projection',configured:[],selected:[],disabled_patterns:[]})
})
