import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const read=p=>readFileSync(resolve(root,p),'utf8')

test('Q7 contributor adding config has one canonical option owner and generated projections',()=>{
 const catalog=JSON.parse(read('data/hi-config-options.json')),ids=catalog.options.map(x=>x.id);assert.equal(new Set(ids).size,ids.length);assert.ok(catalog.options.every(x=>x.owner==='hi-config'))
 assert.match(read('scripts/generate_config_policy.py'),/OUT\.write_bytes/);assert.match(read('plugin/src/generated/config-policy.ts'),/generated from data\/hi-config-options\.json; do not hand edit/)
 const ownership=JSON.parse(read('data/documentation-ownership.json'));assert.ok(ownership.public_documents.some(x=>x.path==='docs/INSTALLATION.md'&&x.area==='installation-configuration-lifecycle'))
})

test('Q7 contributor adding methodology edits canonical catalog rather than duplicate runtime lists',()=>{
 const catalog=JSON.parse(read('data/hi-methodologies.json')),items=catalog.profiles??[];assert.ok(items.length>=27);const names=items.map(x=>x.name);assert.equal(new Set(names).size,names.length)
 assert.match(read('scripts/generate_methodology_policy.py'),/methodology catalog\/package inventory drift/);assert.match(read('plugin/src/generated/methodology-policy.ts'),/generated/i)
 assert.match(read('docs/SKILLS.md'),/canonical machine contract/i)
})

test('Q7 contributor adding host adapter behavior has explicit port and OpenCode boundary',()=>{
 const arch=read('docs/ARCHITECTURE.md'),hosts=read('docs/HOSTS.md');assert.match(arch,/HostPort/);assert.match(arch,/OpenCode SDK uncertainty stays under `plugin\/src\/opencode\/\*\*`/);assert.match(hosts,/future host adapter may bind the same Hi Core roles/)
 const port=read('plugin/src/runtime/host/port.ts');assert.match(port,/export interface HostPort/);assert.doesNotMatch(port,/@opencode-ai\/sdk/)
})

test('Q7 contributor adding validation rule has one architecture lint execution owner and documented acceptance path',()=>{
 const lint=read('scripts/architecture_lint.mjs'),doc=read('docs/VERIFICATION.md'),rootPkg=JSON.parse(read('package.json')),pluginPkg=JSON.parse(read('plugin/package.json'))
 assert.match(lint,/HI022/);assert.match(doc,/npm run check:product/);assert.match(doc,/evidence-validation-readiness\.py/);assert.match(doc,/npm run check:evidence/);assert.match(rootPkg.scripts['check:product'],/plugin run check/);assert.match(rootPkg.scripts['check:evidence'],/validate\.py/);assert.equal(rootPkg.scripts.check,'npm run check:product && npm run check:evidence');assert.equal(rootPkg.scripts['architecture:lint'],'npm --prefix plugin run architecture:lint');assert.match(pluginPkg.scripts['architecture:lint'],/architecture_lint\.mjs/)
 const duplicateFiles=['scripts/validate.py','plugin/src/plugin.ts'].filter(p=>/HI022/.test(read(p)));assert.deepEqual(duplicateFiles,[])
})
