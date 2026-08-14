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
    from:"if(m.user_interrupted||m.status==='stopped')return{decision:'STOP',reason:'user-stop',reason_code:'user-stop'}",
    to:"if(false)return{decision:'STOP',reason:'user-stop',reason_code:'user-stop'}",
    expected:/Q2 explicit user stop dominates idle continuation/,
  },
  {
    id:'external-action-exact-hash-bypass',
    file:'plugin/src/runtime/safety/authority.ts',
    from:"export function isAuthorized(m:MissionState,command:string,cwd?:string):boolean{const c=actionContract(command,cwd);return m.authority?.approved?.hash===c.hash}",
    to:"export function isAuthorized(m:MissionState,command:string,cwd?:string):boolean{actionContract(command,cwd);return Boolean(m.authority?.approved)}",
    expected:/Q2 authority approval is bound to the exact action hash/,
  },
  {
    id:'reviewer-independence-bypass',
    file:'plugin/src/runtime/verification/policy.ts',
    from:"const review=m.obligations.find(o=>o.kind==='review'),independentReview=!p.requireReview||review?.status==='closed'",
    to:"const review=m.obligations.find(o=>o.kind==='review'),independentReview=Boolean(review)||true",
    expected:/Q2 open independent-review obligation cannot be represented as independently reviewed/,
  },
  {
    id:'child-control-plane-deny-bypass',
    file:'plugin/src/hooks/tool-before.ts',
    from:"if(child&&tool.startsWith('hi_'))throw new Error(`Hi ownership guard: child workers cannot invoke Hi control-plane tool '${tool}'.`)",
    to:"if(false&&child&&tool.startsWith('hi_'))throw new Error(`Hi ownership guard: child workers cannot invoke Hi control-plane tool '${tool}'.`)",
    expected:/Q2 child session cannot invoke Hi control-plane tools/,
  },
  {
    id:'changed-file-normalization-bypass',
    file:'plugin/src/runtime/evidence/evidence-runtime.ts',
    from:"if(rel==='..'||rel.startsWith(`..${sep}`)||absolutePath(rel))return clean;",
    to:"if(rel==='..'||rel.startsWith(`..${sep}`)||absolutePath(rel)||Boolean(root&&abs))return clean;",
    expected:/Q2 changed-file ownership path normalization binds absolute project paths to relative scope/,
  },
  {
    id:'unsupported-host-capability-optimistic-support',
    file:'plugin/src/runtime/host/capability-manifest.ts',
    from:"return manifest.capabilities[capability]??'UNSUPPORTED'",
    to:"return manifest.capabilities[capability]??'NATIVE'",
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
  console.log('mutation baseline passed: 8/8 invariant guards green')

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
  console.log(`selective mutation contract passed (${mutants.length}/${mutants.length} critical mutants killed)`)
}finally{
  rmSync(tempRoot,{recursive:true,force:true})
}
