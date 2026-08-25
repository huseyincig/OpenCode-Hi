import {createHash} from 'node:crypto'
import {readFileSync,statSync,realpathSync} from 'node:fs'
import {resolve,sep} from 'node:path'
function inside(child,parent){const c=resolve(child),p=resolve(parent);return c===p||c.startsWith(p+sep)}
export function assertHiddenOracle({oraclePath,fixtureRoot,harnessRoot}){const real=realpathSync(oraclePath),mode=statSync(real).mode&0o777;if(inside(real,fixtureRoot)||inside(real,harnessRoot)||mode&0o077)throw new Error('ORACLE_ISOLATION_VIOLATION');return true}
export function oracleIdentity({path,version,fixtureIdentity}){const sha=createHash('sha256').update(readFileSync(path)).digest('hex'),identity=createHash('sha256').update(`${version}\0${fixtureIdentity}\0${sha}`).digest('hex');return{version,sha256:sha,fixture_identity:fixtureIdentity,identity}}
export function assertWorkloadSpec(spec){for(const key of ['id','title','difficulty','visiblePrompt','fixture','requiredCapabilities','hiddenOracle','requiredEvidence','cleanup'])if(spec[key]===undefined)throw new Error(`WORKLOAD_SPEC_MISSING:${key}`);if(!/^W(?:0[1-9]|1[0-8])$|^WT$/.test(spec.id))throw new Error('WORKLOAD_SPEC_ID_INVALID');if(!spec.fixture?.baseline?.kind||!spec.hiddenOracle?.path||!spec.hiddenOracle?.version)throw new Error('WORKLOAD_SPEC_CONTRACT_INVALID');return spec}

export function promptIdentity(path){const body=readFileSync(path);return{path,sha256:createHash('sha256').update(body).digest('hex')}}
