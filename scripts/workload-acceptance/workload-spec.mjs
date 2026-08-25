import {createHash} from 'node:crypto'
import {readFileSync,statSync,realpathSync} from 'node:fs'
import {resolve,sep} from 'node:path'
function inside(child,parent){const c=resolve(child),p=resolve(parent);return c===p||c.startsWith(p+sep)}
export function assertHiddenOracle({oraclePath,fixtureRoot,harnessRoot}){const real=realpathSync(oraclePath),mode=statSync(real).mode&0o777;if(inside(real,fixtureRoot)||inside(real,harnessRoot)||mode&0o077)throw new Error('ORACLE_ISOLATION_VIOLATION');return true}
export function oracleIdentity({path,version,fixtureIdentity}){const sha=createHash('sha256').update(readFileSync(path)).digest('hex'),identity=createHash('sha256').update(`${version}\0${fixtureIdentity}\0${sha}`).digest('hex');return{version,sha256:sha,fixture_identity:fixtureIdentity,identity}}
export function assertWorkloadSpec(spec){
  for(const key of ['id','title','difficulty','visiblePrompt','fixture','requiredCapabilities','runtimeCapabilities','hiddenOracle','requiredEvidence','cleanup'])if(spec[key]===undefined)throw new Error(`WORKLOAD_SPEC_MISSING:${key}`)
  if(!/^W(?:0[1-9]|1[0-8])$|^WT$/.test(spec.id))throw new Error('WORKLOAD_SPEC_ID_INVALID')
  const fixture=spec.fixture
  if(!fixture||typeof fixture.root!=='string'||!fixture.root.trim()||typeof fixture.seed!=='string'||!fixture.seed.trim()||typeof fixture.resetProcedure!=='string'||!fixture.resetProcedure.trim()||fixture.baseline?.kind!=='sha256'||typeof fixture.baseline?.value!=='string'||!fixture.baseline.value.trim()||!Array.isArray(fixture.allowedMutation)||!fixture.allowedMutation.length)throw new Error('WORKLOAD_SPEC_FIXTURE_CONTRACT_INVALID')
  if(!Array.isArray(spec.requiredCapabilities)||!spec.requiredCapabilities.length||!spec.requiredCapabilities.every(x=>typeof x==='string'&&x.trim()))throw new Error('WORKLOAD_SPEC_CAPABILITIES_INVALID')
  if(!Array.isArray(spec.runtimeCapabilities)||!spec.runtimeCapabilities.length||!spec.runtimeCapabilities.every(x=>typeof x==='string'&&x.trim()))throw new Error('WORKLOAD_SPEC_RUNTIME_CAPABILITIES_INVALID')
  if(!spec.hiddenOracle?.path||!spec.hiddenOracle?.version)throw new Error('WORKLOAD_SPEC_ORACLE_CONTRACT_INVALID')
  if(!Array.isArray(spec.requiredEvidence)||!spec.requiredEvidence.length)throw new Error('WORKLOAD_SPEC_EVIDENCE_INVALID')
  if(spec.cleanup?.ownedOnly!==true)throw new Error('WORKLOAD_SPEC_CLEANUP_OWNERSHIP_INVALID')
  return spec
}

export function promptIdentity(path){const body=readFileSync(path);return{path,sha256:createHash('sha256').update(body).digest('hex')}}
