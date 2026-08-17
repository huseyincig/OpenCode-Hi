import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveHiConfigWithReport } from '../dist/config/resolver.js'
import { resolveModel } from '../dist/runtime/routing/model-resolver.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { normalizeWorkerResult } from '../dist/runtime/task/contracts.js'
import { startAssessedMission } from './helpers/semantic.mjs'
import { evaluateShellCommand } from '../dist/runtime/process/shell-policy.js'
import { capabilityProfile } from '../dist/runtime/capabilities/profiles.js'
import { OPENCODE_REFERENCE_CAPABILITIES,resolveHostCapability } from '../dist/runtime/host/capability-manifest.js'
import { createToolBeforeHook } from '../dist/hooks/tool-before.js'

const baseConfig=()=>resolveHiConfigWithReport({},undefined).config
const models=[{id:'cheap/model',provider:'cheap',cost:1,quality:5,writeCapable:true},{id:'strong/model',provider:'strong',cost:3,quality:9,writeCapable:true}]

test('project topology override reaches mission topology decision',()=>{const root=mkdtempSync(join(tmpdir(),'hi-config-'));try{mkdirSync(join(root,'.opencode','hi','policy'),{recursive:true});writeFileSync(join(root,'.opencode','hi','policy','routing.json'),JSON.stringify({schema:1,type:'hi-routing',execution:{topology:'multi-agent',maxAgents:3,parallelism:2}}));let cfg=resolveHiConfigWithReport({},root).config;const store=new MissionStore(root,{},()=>cfg.primaryMode,()=>({mode:cfg.execution.topology,maxAgents:cfg.execution.maxAgents,parallelism:cfg.execution.parallelism}));assert.equal(startAssessedMission(store,'s','opaque local change',{task_kind:'implementation',scope:'local',required_capabilities:['implementation']}).execution.topology.mode,'multi-agent')}finally{rmSync(root,{recursive:true,force:true})}})
test('explicit task model overrides project fixed model and project fixed overrides adaptive scoring',()=>{const c=baseConfig();c.models={mode:'fixed',default:'cheap/model',roles:{}};assert.equal(resolveModel('deep',models,c,undefined,'coder').primary,'cheap/model');assert.equal(resolveModel('deep',models,c,'strong/model','coder').primary,'strong/model')})
test('project facts do not become methodology observations without the structured reusable-HOW contract',()=>{const fact=normalizeWorkerResult({status:'DONE',summary:'The project uses ResultEnvelope for API errors',changed_files:[],evidence:[],open_issues:[],needs_context:[]});assert.equal(fact.methodology_observations,undefined);const structured=normalizeWorkerResult({status:'DONE',summary:'Reusable project procedure observed',changed_files:[],evidence:[{kind:'review-evidence',summary:'bounded proof',pass:true,outcome:'passed'}],open_issues:[],needs_context:[],methodology_observations:[{key:'project-review-flow',procedure:'Inspect the project-specific review manifest before changing adapters.',trigger:'Adapter review touches the manifest.',do_not_trigger:'No adapter review is involved.',exit_condition:'Manifest constraints are reconciled.',evidence:['review-evidence']}]});assert.equal(structured.methodology_observations?.length,1)})
test('shell policy is non-interactive and never fakes approval',()=>{assert.equal(evaluateShellCommand('npm init').decision,'REWRITE');assert.equal(evaluateShellCommand('gh auth login').decision,'USER_ACTION_REQUIRED');assert.equal(evaluateShellCommand('yes | dangerous-command').decision,'DENY');assert.equal(evaluateShellCommand('npm test').decision,'ALLOW')})
test('tool-before enforces shell rewrite and interactive user-action gate',async()=>{const store=new MissionStore(),m=startAssessedMission(store,'shell-live','opaque local task',{task_kind:'implementation',scope:'local',required_capabilities:['implementation']});const hook=createToolBeforeHook(store);const out={args:{command:'npm init'}};await hook({sessionID:'shell-live',tool:'bash',args:{command:'npm init'}},out);assert.equal(out.args.command,'npm init -y');await assert.rejects(()=>hook({sessionID:'shell-live',tool:'bash',args:{command:'gh auth login'}},{args:{command:'gh auth login'}}),/interactive credential/i);assert.equal(m.identity.status,'waiting-user')})
test('capability profiles never expand release authority implicitly',()=>{const release=capabilityProfile('RELEASE'),research=capabilityProfile('RESEARCH'),sandbox=capabilityProfile('SANDBOX');assert.equal(release.externalSideEffects,true);assert.equal(release.requiresAuthority,true);assert.equal(research.write,false);assert.equal(sandbox.requiresIsolation,true)})
test('reference host exposes owned native process events and workspace isolation primitives',()=>{assert.equal(resolveHostCapability(OPENCODE_REFERENCE_CAPABILITIES,'process_events'),'NATIVE');assert.equal(resolveHostCapability(OPENCODE_REFERENCE_CAPABILITIES,'workspace_isolation'),'NATIVE')})
