import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { scanCanonicalNaming,namingViolationsFor,FOREIGN_CANONICAL_BRANDS } from '../../scripts/naming_namespace_guard.mjs'

const root=new URL('../../',import.meta.url)
const source=rel=>readFileSync(new URL(rel,root),'utf8')

test('N0 living canonical Hi surfaces contain no foreign semantic namespace drift',()=>{
  assert.deepEqual(scanCanonicalNaming(root),[])
})

test('N0 rejects HHC and research-project branding as canonical runtime ownership',()=>{
  for(const {brand} of FOREIGN_CANONICAL_BRANDS){
    const hit=namingViolationsFor('plugin/src/runtime/example-owner.ts',`export class ${brand.replace(/[^A-Za-z0-9]/g,'')}Manager {}`)
    assert.ok(hit.some(x=>x.brand===brand),`missing rejection for ${brand}`)
  }
})

test('N0 preserves OpenCode native and general technical primitive names',()=>{
  assert.deepEqual(namingViolationsFor('plugin/src/runtime/process/executor.ts',`export type ProcessState={pid:number;pty:string;lsp?:string;worktree:string;rpc:'JSON-RPC';socket:'WebSocket'}`),[])
  assert.deepEqual(namingViolationsFor('plugin/src/opencode/open-code-pty-adapter.ts',`export class OpenCodePtyAdapter {}`),[])
})

test('N0 permits a real external product name only at explicit integration boundaries',()=>{
  assert.deepEqual(namingViolationsFor('plugin/src/providers/superpowers-provider.ts',`export class SuperpowersProvider {}`),[])
  assert.ok(namingViolationsFor('plugin/src/runtime/methodology/superpowers-provider.ts',`export class SuperpowersProvider {}`).length>0)
})

test('N0 keeps provenance policy separate from living canonical scan scope',()=>{
  assert.deepEqual(namingViolationsFor('docs/SOURCE-REUSE-MATRIX.md','DCP FlowDeck Octto Skillful HHC historical provenance'),[])
  assert.deepEqual(namingViolationsFor('data/validation/forensic-61-progress.json','HHC immutable receipt'),[])
  const policy=source('docs/HI-NAMING-NAMESPACE.md')
  assert.match(policy,/N1 — Final Hi Namespace Normalization/)
  assert.match(policy,/does \*\*not\*\* bulk-rename/)
  assert.match(policy,/OpenCode-native remains OpenCode/)
})

test('N0 architecture and validator bind the naming policy',()=>{
  const lint=source('scripts/architecture_lint.mjs')
  assert.match(lint,/HI022','NAMING_NAMESPACE_DRIFT'/)
  assert.match(lint,/scanCanonicalNaming\(ROOT\)/)
  assert.match(source('scripts/validate.py'),/HI-NAMING-NAMESPACE\.md/)
})
