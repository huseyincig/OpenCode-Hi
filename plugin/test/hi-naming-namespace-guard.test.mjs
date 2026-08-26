import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { scanCanonicalNaming,namingViolationsFor,FOREIGN_CANONICAL_BRANDS } from '../../scripts/naming_namespace_guard.mjs'

const root=new URL('../../',import.meta.url)
const source=rel=>readFileSync(new URL(rel,root),'utf8')

test('living canonical Hi surfaces contain no foreign semantic namespace drift',()=>{
  assert.deepEqual(scanCanonicalNaming(root),[])
})

test('rejects HHC and research-project branding as canonical runtime ownership',()=>{
  for(const {brand} of FOREIGN_CANONICAL_BRANDS){
    const hit=namingViolationsFor('plugin/src/runtime/example-owner.ts',`export class ${brand.replace(/[^A-Za-z0-9]/g,'')}Manager {}`)
    assert.ok(hit.some(x=>x.brand===brand),`missing rejection for ${brand}`)
  }
})

test('preserves OpenCode native and general technical primitive names',()=>{
  assert.deepEqual(namingViolationsFor('plugin/src/runtime/process/executor.ts',`export type ProcessState={pid:number;pty:string;lsp?:string;worktree:string;rpc:'JSON-RPC';socket:'WebSocket'}`),[])
  assert.deepEqual(namingViolationsFor('plugin/src/opencode/open-code-pty-adapter.ts',`export class OpenCodePtyAdapter {}`),[])
})

test('permits a real external product name only at explicit integration boundaries',()=>{
  assert.deepEqual(namingViolationsFor('plugin/src/providers/superpowers-provider.ts',`export class SuperpowersProvider {}`),[])
  assert.ok(namingViolationsFor('plugin/src/runtime/methodology/superpowers-provider.ts',`export class SuperpowersProvider {}`).length>0)
})

test('keeps local engineering history separate from living canonical scan scope',()=>{
  assert.deepEqual(namingViolationsFor('.project-docs/archive/docs/engineering-constitution/sources/example.md','DCP FlowDeck Octto Skillful HHC historical provenance'),[])
  assert.deepEqual(namingViolationsFor('data/validation/forensic-61-progress.json','HHC immutable receipt'),[])
  const policy=JSON.parse(source('data/documentation-ownership.json'))
  assert.equal(policy.policy.local_only_directory,'.project-docs/')
  assert.equal(policy.policy.historical_or_local_notes_may_not_own_current_truth,true)
})

test('architecture and validator bind the naming policy',()=>{
  const lint=source('scripts/architecture_lint.mjs')
  assert.match(lint,/HI022','NAMING_NAMESPACE_DRIFT'/)
  assert.match(lint,/scanCanonicalNaming\(ROOT\)/)
  assert.match(source('data/documentation-ownership.json'),/one-current-area-one-public-owner/)
})


test('final guard includes compact living architecture install release docs and product catalogs',()=>{
  const guard=source('scripts/naming_namespace_guard.mjs')
  for(const rel of ['data/product.json','data/hi-config-options.json','docs/ARCHITECTURE.md','docs/INSTALLATION.md','docs/RELEASE.md'])assert.match(guard,new RegExp(rel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))
  assert.doesNotMatch(guard,/docs\/ARCHITECTURE-REALITY-MAP\.md/)
  const architecture=source('docs/ARCHITECTURE.md')
  assert.match(architecture,/ProcessContract/)
  assert.match(architecture,/OpenCodeWorkspaceAdapter/)
})
