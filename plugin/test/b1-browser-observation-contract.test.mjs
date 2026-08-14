import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {browserObservationId,isBrowserObservationContract} from '../dist/contracts/browser-observation.js'
import {openCodeHostCapabilityContracts,hostCapabilityByID} from '../dist/contracts/host-capability.js'

const all={childSessions:true,asyncPrompt:true,syncPrompt:true,abort:true,providerInventory:true,appLog:true,sessionStatus:true,childSessionList:true,sessionTodo:true,sessionDiff:true,sessionFork:true,sessionSummarize:true,sessionRevert:true,sessionUnrevert:true}
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const base={task_id:'t_1',executor_version:'browser-adapter/0',url:'https://example.test/view',action:'inspect',timestamp:1700000000000,document_identity:'a'.repeat(64),dom_summary:'button Save visible',console_errors:[],network_errors:[],result:'OBSERVED'}
function observation(overrides={}){const x={...base,...overrides};return{...x,observation_id:browserObservationId(x)}}

test('B1 BrowserObservation is strict bounded and source-identity bound',()=>{
  const x=observation()
  assert.equal(isBrowserObservationContract(x),true)
  assert.equal(isBrowserObservationContract({...x,url:'file:///etc/passwd'}),false)
  assert.equal(isBrowserObservationContract({...x,document_identity:'bad'}),false)
  assert.equal(isBrowserObservationContract({...x,unknown:true}),false)
  assert.equal(isBrowserObservationContract({...x,dom_summary:'x'.repeat(4001)}),false)
})

test('B1 observation identity changes with task executor URL action state artifact and result',()=>{
  const x=observation(),keys=[
    observation({task_id:'t_2'}),observation({executor_version:'browser-adapter/1'}),observation({url:'https://example.test/other'}),observation({action:'click'}),observation({document_identity:'b'.repeat(64)}),observation({screenshot_artifact_ref:'hi-artifact:a_'+ 'c'.repeat(24)}),observation({result:'FAILED',document_identity:undefined,dom_summary:undefined})
  ]
  for(const y of keys)assert.notEqual(y.observation_id,x.observation_id)
})

test('B1 screenshot observations require an ArtifactContract reference and never embed image bytes',()=>{
  const good=observation({action:'screenshot',screenshot_artifact_ref:'hi-artifact:a_'+ 'd'.repeat(24),dom_summary:undefined})
  assert.equal(isBrowserObservationContract(good),true)
  const missing=observation({action:'screenshot',dom_summary:undefined,screenshot_artifact_ref:undefined})
  assert.equal(isBrowserObservationContract(missing),false)
  const source=readFileSync(resolve(root,'plugin/src/contracts/browser-observation.ts'),'utf8')
  assert.doesNotMatch(source,/base64|image_bytes|screenshot_bytes|Buffer</i)
})

test('B1 an observation is not Evidence and does not promote browser execution',()=>{
  const source=readFileSync(resolve(root,'plugin/src/contracts/browser-observation.ts'),'utf8')
  assert.doesNotMatch(source,/EvidenceItem|addEvidence|verificationSatisfied/)
  const cap=hostCapabilityByID(openCodeHostCapabilityContracts(all),'browser-execution')
  assert.equal(cap?.status,'UNSUPPORTED')
  assert.equal(cap?.native_primitive,undefined)
})

test('B1 failed observations may record bounded errors without fabricating DOM screenshot or PASS',()=>{
  const x=observation({result:'FAILED',document_identity:undefined,dom_summary:undefined,console_errors:['page crashed'],network_errors:['GET /api 500']})
  assert.equal(isBrowserObservationContract(x),true)
  const emptyObserved=observation({document_identity:undefined,dom_summary:undefined,console_errors:[],network_errors:[]})
  assert.equal(isBrowserObservationContract(emptyObserved),false)
})
