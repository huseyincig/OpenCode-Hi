#!/usr/bin/env node
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs'
import {join,relative,resolve,sep} from 'node:path'
import {scanCanonicalNaming} from './naming_namespace_guard.mjs'

const ROOT=resolve(new URL('..',import.meta.url).pathname)
const unix=p=>p.split(sep).join('/')
const sha=p=>createHash('sha256').update(readFileSync(join(ROOT,p))).digest('hex')
const json=p=>JSON.parse(readFileSync(join(ROOT,p),'utf8'))
const walk=(dir,out=[])=>{for(const name of readdirSync(dir)){const p=join(dir,name),s=statSync(p);if(s.isDirectory()){if(['.git','node_modules','dist','__pycache__','.pytest_cache'].includes(name))continue;walk(p,out)}else out.push(p)}return out}
const excludedPathPrefixes=['docs/engineering-constitution/sources/','data/validation/external-','data/validation/forensic-']
const excludedPaths=new Set([
  'docs/BASELINE-RECEIPT.md','docs/SOURCE-REUSE-MATRIX.md','docs/TERMINOLOGY.md','docs/PRODUCT-IDENTITY.md',
  'docs/CANONICAL-IMPLEMENTATION-PROMPT.txt','plugin/test/config-no-legacy-superpowers.test.mjs'
])
const suspicious=/(?:^|[\/_-])(hhc|oho|superpowers|flowdeck|octto|skillful|orchestra|hiai)(?:[\/_-]|$)/i
const suspiciousPaths=walk(ROOT).map(p=>unix(relative(ROOT,p))).filter(rel=>suspicious.test(rel)&&!excludedPaths.has(rel)&&!excludedPathPrefixes.some(x=>rel.startsWith(x)))
const namingViolations=scanCanonicalNaming(ROOT)
const pkg=json('package.json'),product=json('data/product.json'),roles=json('data/hi-roles.json').roles??[],options=json('data/hi-config-options.json').options??[]
const skills=readdirSync(join(ROOT,'skills')).filter(name=>statSync(join(ROOT,'skills',name)).isDirectory()).sort()
const toolSource=readFileSync(join(ROOT,'plugin/src/opencode/tool-namespace.ts'),'utf8')
const staleChecks={
  architecture_reality_process_not_adopted:/not currently adopted as Hi process ownership/i.test(readFileSync(join(ROOT,'docs/ARCHITECTURE-REALITY-MAP.md'),'utf8')),
  release_manual_latest_host:/latest completed exact-host acceptance/i.test(readFileSync(join(ROOT,'docs/RELEASE.md'),'utf8')),
}
const publicChecks={
  product_name:product.product_name==='OpenCode-Hi',
  package_name:pkg.name==='opencode-hi',
  repository:product.repository==='https://github.com/huseyincig/OpenCode-Hi',
  skill_namespace:skills.length===27&&skills.every(x=>x.startsWith('hi-')),
  role_ids_clean:roles.every(x=>typeof x.id==='string'&&!/(hhc|oho|superpowers|flowdeck|octto|skillful|orchestra|hiai)/i.test(x.id)),
  config_paths_clean:options.every(x=>typeof x.path==='string'&&!/(hhc|oho|superpowers|flowdeck|octto|skillful|orchestra|hiai)/i.test(x.path)),
  tool_namespace_guard_present:/x\.startsWith\('hi_'\)/.test(toolSource),
}
const pass=namingViolations.length===0&&suspiciousPaths.length===0&&Object.values(publicChecks).every(Boolean)&&Object.values(staleChecks).every(x=>x===false)
const receipt={
  schema:1,release:'0.1.0',kind:'FINAL_HI_NAMESPACE_NORMALIZATION',generated_at:'2026-08-15',status:pass?'PASS':'FAIL',
  claim_boundary:'Final living product namespace/status-coherence projection only. Historical provenance, immutable receipts, source-study material, and negative rejection tests are intentionally excluded from rename pressure.',
  canonical:{product:'OpenCode-Hi',package:'opencode-hi',skill_namespace:'hi-*',tool_namespace:'hi_*'},
  guard:{violations:namingViolations,expanded_living_scope:['data/product.json','data/hi-config-options.json','docs/ARCHITECTURE-REALITY-MAP.md','docs/INSTALLATION.md','docs/RELEASE.md']},
  public_surface:{...publicChecks,skill_count:skills.length,role_ids:roles.map(x=>x.id).sort(),config_option_count:options.length},
  path_audit:{violations:suspiciousPaths,excluded_provenance_or_negative_surfaces:[...excludedPaths].sort(),excluded_prefixes:excludedPathPrefixes},
  stale_living_status:staleChecks,
  allowed_noncanonical_names:[
    {name:'OpenCode',reason:'native host primitive/integration name'},
    {name:'Autopilot',reason:'explicit public alias for automatic continuation retained by terminology policy'},
    {name:'general technical primitives',reason:'PTY/PID/LSP/Git worktree/WebSocket/JSON-RPC keep standard names'}
  ],
  inputs:{
    naming_guard:{path:'scripts/naming_namespace_guard.mjs',sha256:sha('scripts/naming_namespace_guard.mjs')},
    terminology:{path:'data/validation/terminology-audit-0.1.0.json',sha256:sha('data/validation/terminology-audit-0.1.0.json')},
    product:{path:'data/product.json',sha256:sha('data/product.json')},
    config_catalog:{path:'data/hi-config-options.json',sha256:sha('data/hi-config-options.json')},
    role_catalog:{path:'data/hi-roles.json',sha256:sha('data/hi-roles.json')},
    architecture_reality:{path:'docs/ARCHITECTURE-REALITY-MAP.md',sha256:sha('docs/ARCHITECTURE-REALITY-MAP.md')}
  },
  rules:[
    'living Hi-owned semantic surfaces do not adopt research-product branding as canonical owners',
    'OpenCode-native and general technical primitive names remain unrenamed',
    'historical provenance and negative rejection fixtures remain exact and are not cosmetically rewritten',
    'no persistence/config compatibility migration is created without an actual living legacy alias'
  ]
}
writeFileSync(join(ROOT,'data/validation/namespace-normalization-0.1.0.json'),JSON.stringify(receipt,null,2)+'\n')
console.log(`wrote namespace-normalization-0.1.0.json status=${receipt.status}`)
if(!pass)process.exitCode=1
