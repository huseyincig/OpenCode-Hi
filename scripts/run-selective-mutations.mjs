import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repository=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const tempRoot=mkdtempSync(join(tmpdir(),'opencode-hi-q2-mutations-'))
const checkout=join(tempRoot,'checkout')
const guard='plugin/test/q2-critical-invariant-guards.test.mjs'

const mutants=[

  {
    id:'completion-required-evidence-bypass',
    file:'plugin/src/runtime/verification/policy.ts',
    from:"return{ok:missing.length===0,missing:[...new Set(missing)]}",
    to:"return{ok:true,missing:[...new Set(missing)]}",
    expected:/Q2 completion cannot pass without required evidence/,
  },
  {
    id:'native-bash-deny-to-allow',
    file:'plugin/src/runtime/process/authority.ts',
    from:"if(bash==='deny')return{decision:'DENY',reason:'bash-permission:deny',command_line:commandLine,external_cwd:externalCwd}",
    to:"if(false&&bash==='deny')return{decision:'DENY',reason:'bash-permission:deny',command_line:commandLine,external_cwd:externalCwd}",
    expected:/Q2 explicit native bash deny cannot become allow/,
  },
  {
    id:'project-authority-permission-widening',
    file:'plugin/src/runtime/safety/project-authority.ts',
    from:"if(existing==='deny'){config.permission=permission;return}",
    to:"if(false&&existing==='deny'){config.permission=permission;return}",
    expected:/Q2 project authority merge cannot widen a native top-level deny/,
  },
  {
    id:'canonical-owner-uniqueness-bypass',
    file:'plugin/src/contracts/storage-ownership.ts',
    from:"if(seen.has(key))throw new Error(`Duplicate canonical storage owner: ${key}`)",
    to:"if(false&&seen.has(key))throw new Error(`Duplicate canonical storage owner: ${key}`)",
    expected:/Q2 canonical storage owner uniqueness rejects duplicate scope\/data-class ownership/,
  },
  {
    id:'restart-schema-rejection-bypass',
    file:'plugin/src/runtime/state/persistence.ts',
    from:"if(schema!==RUNTIME_STATE_SCHEMA)throw new Error(`unsupported runtime-state schema ${String(parsed.schema)}`)",
    to:"if(schema===RUNTIME_STATE_SCHEMA)throw new Error(`unsupported runtime-state schema ${String(parsed.schema)}`)",
    expected:/Q2 restart persistence rejects unsupported schema instead of loading it/,
  },
  {
    id:'config-max-fallbacks-executable-effect-bypass',
    file:'plugin/src/runtime/routing/model-resolver.ts',
    from:"fallbacks=ordered.slice(1,1+config.routing.maxFallbacks)",
    to:"fallbacks=ordered.slice(1,1+6)",
    expected:/Q2 routing maxFallbacks has an executable effect/,
  },
  {
    id:'path-confinement-parent-segment-bypass',
    file:'plugin/src/contracts/common.ts',
    from:"segments.some(segment=>!segment||segment==='.'||segment==='..')",
    to:"segments.some(segment=>!segment||segment==='.')",
    expected:/Q2 absolute path confinement rejects paths outside the project root/,
  },
  {
    id:'manager-write-deny-to-allow',
    file:'plugin/src/runtime/roles/catalog.ts',
    from:"return !contract.readOnly&&writeAuthority!=='none'",
    to:"return role==='manager'||(!contract.readOnly&&writeAuthority!=='none')",
    expected:/Q2 manager remains denied direct repository write authority/,
  },
  {
    id:'evidence-freshness-bypass',
    file:'plugin/src/runtime/verification/policy.ts',
    from:"return Boolean(e&&!e.invalidated_at)",
    to:"return Boolean(e)",
    expected:/Q2 invalidated pre-mutation evidence cannot satisfy freshness/,
  },
  {
    id:'stop-bypass',
    file:'plugin/src/runtime/continuation/evaluator.ts',
    from:"if(m.continuation.user_interrupted||m.identity.status==='stopped')return{decision:'STOP',reason:'user-stop',reason_code:'user-stop'}",
    to:"if(m.continuation.user_interrupted&&m.identity.status==='stopped')return{decision:'STOP',reason:'user-stop',reason_code:'user-stop'}",
    expected:/Q2 explicit user stop dominates idle continuation/,
  },
  {
    id:'external-action-exact-hash-bypass',
    file:'plugin/src/runtime/safety/authority.ts',
    from:"export function isAuthorized(m:MissionState,command:string,cwd?:string):boolean{const c=actionContract(command,cwd),a=m.authority.authority?.approved;return Boolean(a&&a.hash===c.hash&&freshAuthorityTimestamp(a.approved_at))}",
    to:"export function isAuthorized(m:MissionState,command:string,cwd?:string):boolean{actionContract(command,cwd);const a=m.authority.authority?.approved;return Boolean(a&&freshAuthorityTimestamp(a.approved_at))}",
    expected:/Q2 authority approval is bound to the exact action hash/,
  },
  {
    id:'reviewer-independence-bypass',
    file:'plugin/src/runtime/verification/policy.ts',
    from:"const review=m.execution.obligations.find(o=>o.kind==='review'),independentReview=!p.requireReview||review?.status==='closed'",
    to:"const review=m.execution.obligations.find(o=>o.kind==='review'),independentReview=!p.requireReview||Boolean(review)",
    expected:/Q2 open independent-review obligation cannot be represented as independently reviewed/,
  },
  {
    id:'child-control-plane-deny-bypass',
    file:'plugin/src/hooks/tool-before.ts',
    from:"else throw new Error(`Hi ownership guard: child workers cannot invoke Hi control-plane tool '${tool}'.`)",
    to:"else if(tool==='__mutation_never__')throw new Error(`Hi ownership guard: child workers cannot invoke Hi control-plane tool '${tool}'.`)",
    expected:/Q2 child session cannot invoke Hi control-plane tools/,
  },
  {
    id:'changed-file-normalization-bypass',
    file:'plugin/src/runtime/evidence/evidence-runtime.ts',
    from:"if(!rel)return'';if(rel==='..'",
    to:"if(!rel)return'';return'';if(rel==='..'",
    expected:/Q2 changed-file ownership path normalization binds absolute project paths to relative scope/,
  },
  {
    id:'unsupported-host-capability-optimistic-support',
    file:'plugin/src/runtime/host/capability-manifest.ts',
    from:"export function resolveHostCapability(manifest:CapabilityManifest,capability:HostCapability):CapabilityResolution{return manifest.capabilities[capability]??'UNSUPPORTED'}",
    to:"export function resolveHostCapability(manifest:CapabilityManifest,capability:HostCapability):CapabilityResolution{return manifest.capabilities[capability]??'NATIVE'}",
    expected:/Q2 absent host capability is UNSUPPORTED, never optimistic support/,
  },
]

function run(command,args,cwd,allowFailure=false){
  const r=spawnSync(command,args,{cwd,encoding:'utf8',env:{...process.env,HOME:join(tempRoot,'home'),XDG_STATE_HOME:join(tempRoot,'state'),XDG_DATA_HOME:join(tempRoot,'data'),XDG_CONFIG_HOME:join(tempRoot,'config'),XDG_CACHE_HOME:join(tempRoot,'cache')}})
  if(!allowFailure&&r.status!==0)throw new Error(`${command} ${args.join(' ')} failed (${r.status})\n${r.stdout}\n${r.stderr}`)
  return r
}
function build(){run('npm',['run','build'],join(checkout,'plugin'))}
function testGuard(allowFailure=false){return run('npm',['exec','--','node','--test','test/q2-critical-invariant-guards.test.mjs'],join(checkout,'plugin'),allowFailure)}
function restore(file){cpSync(join(repository,file),join(checkout,file),{force:true})}

try{
  cpSync(repository,checkout,{recursive:true,filter:(source)=>{const rel=source.slice(repository.length).replace(/^\/+/, '');return !rel.startsWith('.git')&&!rel.startsWith('plugin/node_modules')&&!rel.startsWith('plugin/dist')}})
  if(existsSync(join(repository,'plugin','node_modules')))symlinkSync(join(repository,'plugin','node_modules'),join(checkout,'plugin','node_modules'),'dir')
  build()
  const baseline=testGuard()
  assert.equal(baseline.status,0,'Q2 mutation baseline guard must be green')
  console.log(`mutation baseline passed: ${mutants.length} selective invariant guards configured`)

  for(const mutant of mutants){
    restore(mutant.file)
    const path=join(checkout,mutant.file),original=readFileSync(path,'utf8')
    const occurrences=original.split(mutant.from).length-1
    assert.equal(occurrences,1,`${mutant.id}: mutation anchor must match exactly once; got ${occurrences}`)
    const mutated=original.replace(mutant.from,mutant.to)
    assert.notEqual(mutated,original,`${mutant.id}: replacement did not mutate source`)
    writeFileSync(path,mutated)
    build()
    const result=testGuard(true),combined=`${result.stdout}\n${result.stderr}`
    assert.notEqual(result.status,0,`${mutant.id}: normal invariant guard suite survived mutant`)
    assert.match(combined,mutant.expected,`${mutant.id}: suite failed, but not at the expected invariant guard`)
    console.log(`killed mutant: ${mutant.id}`)
  }
  const sourceCommit=spawnSync('git',['rev-parse','HEAD'],{cwd:repository,encoding:'utf8'}).stdout.trim()
  const sourceTree=spawnSync('git',['rev-parse','HEAD^{tree}'],{cwd:repository,encoding:'utf8'}).stdout.trim()
  const receipt={schema:1,kind:'PROMPT_B_SELECTIVE_MUTATION_ACCEPTANCE',program:'PROMPT_B',section:31,status:'PASS',source:{commit:sourceCommit,tree:sourceTree},summary:{configured:mutants.length,killed:mutants.length,survived:0,compile_only_kills:0},mutants:mutants.map(m=>({id:m.id,status:'KILLED_BY_INVARIANT_TEST',source:m.file})),coverage:{authority_deny_allow:['native-bash-deny-to-allow','external-action-exact-hash-bypass'],completion_evidence:['completion-required-evidence-bypass'],permission_monotonicity:['project-authority-permission-widening'],owner_uniqueness:['canonical-owner-uniqueness-bypass'],stale_evidence:['evidence-freshness-bypass'],path_confinement:['path-confinement-parent-segment-bypass','changed-file-normalization-bypass'],restart_schema_rejection:['restart-schema-rejection-bypass'],config_executable_effect:['config-max-fallbacks-executable-effect-bypass'],capability_support_truth:['unsupported-host-capability-optimistic-support'],additional_critical_guards:['manager-write-deny-to-allow','stop-bypass','reviewer-independence-bypass','child-control-plane-deny-bypass']},claim_boundary:'Selective mutation testing only. A mutant counts as killed only when the compiled mutant is rejected by the expected invariant guard; compile failures are not accepted as kills.'}
  writeFileSync(join(repository,'data/validation/selective-mutation-testing-0.1.0.json'),JSON.stringify(receipt,null,2)+'\n')
  console.log(`selective mutation contract passed (${mutants.length}/${mutants.length} critical mutants killed)`)
}finally{
  rmSync(tempRoot,{recursive:true,force:true})
}
