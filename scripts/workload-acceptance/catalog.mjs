import {createHash} from 'node:crypto'
import {existsSync,readFileSync,writeFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {fixtureIdentity} from './fixture-manager.mjs'
import {assertWorkloadSpec,oracleIdentity,promptIdentity} from './workload-spec.mjs'

const PROJECT_ROOT=resolve(import.meta.dirname,'../..')
export const WORKLOAD_IDS=Object.freeze(Array.from({length:18},(_,i)=>`W${String(i+1).padStart(2,'0')}`))
export const W_CATALOG_ROOT=resolve(import.meta.dirname,'../../.agent-work/workload-acceptance')
export const W_PROMPT_CATALOG_PATH=join(W_CATALOG_ROOT,'W-PROMPTS.md')
export const W_CATALOG_MANIFEST_PATH=join(W_CATALOG_ROOT,'catalog.json')
const sha=b=>createHash('sha256').update(b).digest('hex')

export function parseCanonicalPromptCatalog(path=W_PROMPT_CATALOG_PATH){
  const body=readFileSync(path,'utf8'),re=/^##\s+\d+\.\s+(W(?:0[1-9]|1[0-8]))\s+—[^\n]*\n\n```text\n([\s\S]*?)\n```/gm,out={}
  for(const m of body.matchAll(re)){if(out[m[1]])throw new Error(`W_PROMPT_DUPLICATE:${m[1]}`);out[m[1]]=m[2]+'\n'}
  const ids=Object.keys(out).sort();if(ids.length!==18||WORKLOAD_IDS.some(id=>!out[id]))throw new Error(`W_PROMPT_CATALOG_INCOMPLETE:${ids.length}`)
  return{source:path,source_sha256:sha(readFileSync(path)),prompts:out}
}

export function buildCatalogManifest(){
  const canonical=parseCanonicalPromptCatalog(),entries={}
  for(const id of WORKLOAD_IDS){
    const specPath=join(W_CATALOG_ROOT,id,'spec.json');if(!existsSync(specPath))throw new Error(`W_SPEC_MISSING:${id}`)
    const spec=JSON.parse(readFileSync(specPath,'utf8'));assertWorkloadSpec(spec);if(spec.id!==id)throw new Error(`W_SPEC_ID_MISMATCH:${id}:${spec.id}`)
    const promptPath=resolve(PROJECT_ROOT,spec.visiblePrompt),prompt=readFileSync(promptPath,'utf8');if(prompt!==canonical.prompts[id])throw new Error(`W_PROMPT_BINDING_MISMATCH:${id}`)
    const seed=resolve(PROJECT_ROOT,spec.fixture.seed),seedIdentity=fixtureIdentity(seed);if(seedIdentity!==spec.fixture.baseline.value)throw new Error(`W_SEED_IDENTITY_MISMATCH:${id}`)
    const oraclePath=resolve(PROJECT_ROOT,spec.hiddenOracle.path),oi=oracleIdentity({path:oraclePath,version:spec.hiddenOracle.version,fixtureIdentity:seedIdentity})
    entries[id]={id,title:spec.title,difficulty:spec.difficulty,spec_path:specPath,prompt_path:promptPath,prompt_sha256:promptIdentity(promptPath).sha256,fixture_seed:seed,fixture_sha256:seedIdentity,oracle_path:oraclePath,oracle_version:spec.hiddenOracle.version,oracle_sha256:oi.sha256,oracle_identity:oi.identity,runtime_capabilities:spec.runtimeCapabilities,required_capabilities:spec.requiredCapabilities,required_evidence:spec.requiredEvidence,provenance:{canonical_prompt_source:canonical.source,canonical_prompt_catalog_sha256:canonical.source_sha256,...(spec.provenance??{})}}
  }
  return{schema:1,kind:'w-immutable-workload-catalog',entry_count:18,canonical_prompt_source:canonical.source,canonical_prompt_catalog_sha256:canonical.source_sha256,entries}
}

export function writeCatalogManifest(path=W_CATALOG_MANIFEST_PATH){const catalog=buildCatalogManifest();writeFileSync(path,JSON.stringify(catalog,null,2)+'\n',{mode:0o600});return catalog}
export function loadCatalogManifest(path=W_CATALOG_MANIFEST_PATH){if(!existsSync(path))throw new Error('W_CATALOG_MANIFEST_MISSING');const x=JSON.parse(readFileSync(path,'utf8'));if(x.schema!==1||x.entry_count!==18)throw new Error('W_CATALOG_MANIFEST_INVALID');for(const id of WORKLOAD_IDS)if(x.entries?.[id]?.id!==id)throw new Error(`W_CATALOG_ENTRY_INVALID:${id}`);return x}
export function resolveCatalogEntry(id,{catalog=loadCatalogManifest()}={}){if(!WORKLOAD_IDS.includes(id))throw new Error(`W_WORKLOAD_ID_INVALID:${id}`);const fresh=buildCatalogManifest().entries[id],recorded=catalog.entries[id];for(const key of ['prompt_sha256','fixture_sha256','oracle_identity'])if(recorded[key]!==fresh[key])throw new Error(`W_CATALOG_IDENTITY_DRIFT:${id}:${key}`);return fresh}
