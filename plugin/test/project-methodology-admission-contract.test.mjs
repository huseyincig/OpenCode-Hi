import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {discoverProjectMethodologyPolicies} from '../dist/runtime/methodology/project-policy.js'
import {methodologyCatalog} from '../dist/runtime/methodology/catalog.js'
import {applyAdmittedProjectMethodologyPermissions} from '../dist/runtime/methodology/host-permissions.js'
import {methodologySkillCandidates,resolveSkillPlan} from '../dist/runtime/skills/registry.js'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {activateMethodologySignal} from '../dist/runtime/methodology/activation.js'
import {fileURLToPath} from 'node:url'
import {opencodeChildPort} from './helpers/host-port.mjs'
import {projectHiOpenCodeAgents} from '../dist/opencode/agent-binding.js'

const hiRoot=fileURLToPath(new URL('../../',import.meta.url)).replace(/[\\/]$/,'')
const sha=text=>createHash('sha256').update(text).digest('hex')

function fixture(){
  const root=mkdtempSync(join(tmpdir(),'hi-project-methodology-')),name='hi-project-lockfile-review'
  const skill=`---\nname: ${name}\ndescription: Review this project's lockfile-specific generated metadata contract.\n---\n\n# Lockfile Review\n\n## Contract\n\n- **Trigger:** This project dependency lock surface changes.\n- **Do not trigger:** No project dependency lock surface changed.\n- **Exit condition:** Project-specific lock metadata and verification are reconciled.\n\n## Method\n\n1. Inspect the changed dependency declaration and lock metadata owned by this project.\n2. Reconcile the project-specific generated fields without broad dependency churn.\n3. Run the smallest project-native lock verification and record any unresolved incompatibility.\n`
  const policy={schema:1,type:'hi-project-methodology',name,enabled:true,purpose:"Review this project's lockfile-specific generated metadata contract.",trigger:'This project dependency lock surface changes.',do_not_trigger:'No project dependency lock surface changed.',exit_condition:'Project-specific lock metadata and verification are reconciled.',preferred_roles:['coder'],compatible_roles:['coder'],activation_signals:['surface.dependency'],exit_requirements:['task-success','no-open-issues','fresh-verification'],priority:'normal',context_cost:'low',execution_cost:'low',weight:.6,composition_cost:'low',useful_coexistence:['hi-test-strategy'],conflicts:[],resource_requirements:[],admission:'project-intelligence'}
  const policyText=JSON.stringify(policy,null,2)+'\n'
  const candidateContract={key:'lockfile-review',procedure:'Project lockfile review procedure',trigger:policy.trigger,do_not_trigger:policy.do_not_trigger,exit_condition:policy.exit_condition},candidateSha=sha([candidateContract.key,candidateContract.procedure,candidateContract.trigger,candidateContract.do_not_trigger,candidateContract.exit_condition].join('\0')),candidateID='mc_'+candidateSha.slice(0,24),skillPath=join(root,'.opencode','skills',name,'SKILL.md'),policyPath=join(root,'.opencode','hi','policy','methodologies',`${name}.json`),provenancePath=join(root,'.opencode','hi','provenance','methodologies',`${name}.json`),candidatePath=join(root,'.opencode','hi','project-intelligence','methodology-candidates',`${candidateID}.json`)
  mkdirSync(join(skillPath,'..'),{recursive:true});mkdirSync(join(policyPath,'..'),{recursive:true});mkdirSync(join(provenancePath,'..'),{recursive:true});mkdirSync(join(candidatePath,'..'),{recursive:true})
  writeFileSync(skillPath,skill);writeFileSync(policyPath,policyText)
  const now=Date.now();writeFileSync(candidatePath,JSON.stringify({schema:1,id:candidateID,contract_sha256:candidateSha,...candidateContract,state:'READY',observations:[{mission_id:'m1',task_id:'t1',worker_id:'w1',evidence:['lock-proof-1'],observed_at:now-2},{mission_id:'m2',task_id:'t2',worker_id:'w2',evidence:['lock-proof-2'],observed_at:now-1}],created_at:now-2,updated_at:now},null,2)+'\n');writeFileSync(provenancePath,JSON.stringify({schema:1,type:'hi-methodology-provenance',name,origin:'project-learning',candidate_id:candidateID,evidence:['missions:m1,m2 repeated lock metadata procedure'],skill_sha256:sha(skill),policy_sha256:sha(policyText),created_at:now,validated_at:now},null,2)+'\n')
  return{root,name,skillPath,policyPath,provenancePath,candidatePath,candidateID}
}
const clone=value=>JSON.parse(JSON.stringify(value))

test('project methodology is admitted only when skill, policy and hash-bound provenance are coherent',()=>{
  const f=fixture();try{
    assert.deepEqual(discoverProjectMethodologyPolicies(f.root).map(x=>x.name),[f.name])
    assert.ok(methodologyCatalog(f.root).some(x=>x.name===f.name&&x.provider==='project'))
    writeFileSync(f.skillPath,readFileSync(f.skillPath,'utf8')+'\n<!-- changed after validation -->\n')
    assert.deepEqual(discoverProjectMethodologyPolicies(f.root),[])
    assert.ok(!methodologyCatalog(f.root).some(x=>x.name===f.name))
  }finally{rmSync(f.root,{recursive:true,force:true})}
})

test('project-learning admission rejects an incoherent READY candidate contract hash',()=>{
  const f=fixture();try{
    const candidate=JSON.parse(readFileSync(f.candidatePath,'utf8'))
    candidate.contract_sha256='0000000000000000000000000000000000000000000000000000000000000000'
    writeFileSync(f.candidatePath,JSON.stringify(candidate,null,2)+'\n')
    assert.deepEqual(discoverProjectMethodologyPolicies(f.root),[])
    assert.ok(!methodologyCatalog(f.root).some(x=>x.name===f.name))
  }finally{rmSync(f.root,{recursive:true,force:true})}
})

test('admitted project methodology derives an exact native ask only for compatible roles unless host/user explicitly trusts it',()=>{
  const f=fixture();try{
    const config={};projectHiOpenCodeAgents(config,{coder:PACKAGED_HI_AGENTS.coder,'qa-reviewer':PACKAGED_HI_AGENTS['qa-reviewer']})
    const applied=applyAdmittedProjectMethodologyPermissions(config,f.root)
    assert.ok(applied.some(x=>x.name===f.name&&x.role==='coder'&&x.decision==='ask'))
    assert.equal(config.agent.coder.permission.skill[f.name],'ask')
    assert.equal(config.agent['qa-reviewer'].permission.skill[f.name],undefined)
    assert.equal(config.agent.coder.permission.skill['*'],'deny')
  }finally{rmSync(f.root,{recursive:true,force:true})}
})

test('explicit native deny is preserved even for an admitted compatible project methodology',()=>{
  const f=fixture();try{
    const coder=clone(PACKAGED_HI_AGENTS.coder);coder.permission.skill[f.name]='deny'
    const config={agent:{coder}}
    applyAdmittedProjectMethodologyPermissions(config,f.root)
    assert.equal(config.agent.coder.permission.skill[f.name],'deny')
  }finally{rmSync(f.root,{recursive:true,force:true})}
})

test('admitted project methodology reaches native lazy selection as project provider',()=>{
  const f=fixture();try{
    const config={};projectHiOpenCodeAgents(config,{coder:PACKAGED_HI_AGENTS.coder});applyAdmittedProjectMethodologyPermissions(config,f.root)
    const catalog=methodologyCatalog(f.root),candidates=methodologySkillCandidates([f.name],f.root,hiRoot,{},catalog)
    const plan=resolveSkillPlan([f.name],candidates,config.agent.coder.permission.skill,true,'coder',catalog)
    assert.deepEqual(plan.selected.map(x=>[x.name,x.provider]),[[f.name,'project']])
  }finally{rmSync(f.root,{recursive:true,force:true})}
})


test('project-learning provenance without a READY repeated-evidence candidate is not admitted',()=>{
  const f=fixture();try{
    const candidate=JSON.parse(readFileSync(f.candidatePath,'utf8'));candidate.state='CANDIDATE';candidate.observations=candidate.observations.slice(0,1);writeFileSync(f.candidatePath,JSON.stringify(candidate,null,2)+'\n')
    assert.deepEqual(discoverProjectMethodologyPolicies(f.root),[])
  }finally{rmSync(f.root,{recursive:true,force:true})}
})

test('retired project methodology leaves catalog and receives no derived native permission',()=>{
  const f=fixture();try{
    const policy=JSON.parse(readFileSync(f.policyPath,'utf8'));policy.enabled=false;const policyText=JSON.stringify(policy,null,2)+'\n';writeFileSync(f.policyPath,policyText)
    const provenance=JSON.parse(readFileSync(f.provenancePath,'utf8'));provenance.policy_sha256=sha(policyText);provenance.validated_at=Date.now();writeFileSync(f.provenancePath,JSON.stringify(provenance,null,2)+'\n')
    assert.ok(!methodologyCatalog(f.root).some(x=>x.name===f.name))
    const config={agent:{coder:clone(PACKAGED_HI_AGENTS.coder)}};const applied=applyAdmittedProjectMethodologyPermissions(config,f.root)
    assert.ok(!applied.some(x=>x.name===f.name));assert.equal(config.agent.coder.permission.skill[f.name],undefined)
  }finally{rmSync(f.root,{recursive:true,force:true})}
})

test('project methodology update requires fresh provenance hash before re-admission',()=>{
  const f=fixture();try{
    const policy=JSON.parse(readFileSync(f.policyPath,'utf8'));policy.exit_condition='Updated project-specific lock contract is reconciled.';const policyText=JSON.stringify(policy,null,2)+'\n';writeFileSync(f.policyPath,policyText)
    const skill=readFileSync(f.skillPath,'utf8').replace('Project-specific lock metadata and verification are reconciled.','Updated project-specific lock contract is reconciled.');writeFileSync(f.skillPath,skill)
    assert.deepEqual(discoverProjectMethodologyPolicies(f.root),[])
    const provenance=JSON.parse(readFileSync(f.provenancePath,'utf8'));provenance.skill_sha256=sha(skill);provenance.policy_sha256=sha(policyText);provenance.validated_at=Date.now();writeFileSync(f.provenancePath,JSON.stringify(provenance,null,2)+'\n')
    assert.deepEqual(discoverProjectMethodologyPolicies(f.root).map(x=>x.name),[f.name])
  }finally{rmSync(f.root,{recursive:true,force:true})}
})


test('TaskRuntime hot-refreshes an admitted project methodology permission before same-process task selection',async()=>{
  const f=fixture();try{
    const host={};projectHiOpenCodeAgents(host,{coder:PACKAGED_HI_AGENTS.coder})
    assert.equal(host.agent.coder.permission.skill[f.name],undefined)
    const client={session:{create:async()=>({data:{id:'child-hot'}}),promptAsync:async()=>({data:{}}),diff:async()=>({data:[]})}}
    const runtime=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),f.root,hiRoot,()=>DEFAULT_HI_CONFIG,()=>[],()=>host)
    const store=new MissionStore(f.root),m=store.start('s-hot-project-methodology','Update dependency metadata')
    store.applyInitialSemanticAssessment('s-hot-project-methodology',{material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:['package.json'],intent_signals:[],suppressed_intent_signals:[]})
    m.methodology.methodology_needs=[]
    activateMethodologySignal(m,f.root,{signal:'surface.dependency',producer:'changed-surface',reason:'dependency surface changed in prior bounded work'})
    const started=await runtime.start(m,{objective:'Reconcile the dependency metadata',role:'coder',scope:['package.json']})
    assert.equal(host.agent.coder.permission.skill[f.name],'ask')
    assert.ok(started.methodologies.includes(f.name))
    assert.ok(m.execution.workers.find(w=>w.id===started.worker_id)?.selected_methodologies.includes(f.name))
  }finally{rmSync(f.root,{recursive:true,force:true})}
})


test('pre-existing host wildcard skill deny is not widened to ASK by project methodology admission',()=>{
  const f=fixture();try{
    const coder=clone(PACKAGED_HI_AGENTS.coder),config={agent:{coder}}
    const applied=applyAdmittedProjectMethodologyPermissions(config,f.root)
    assert.ok(applied.some(x=>x.name===f.name&&x.role==='coder'&&x.decision==='deny'))
    assert.equal(config.agent.coder.permission.skill[f.name],undefined)
    assert.equal(config.agent.coder.permission.skill['*'],'deny')
  }finally{rmSync(f.root,{recursive:true,force:true})}
})
