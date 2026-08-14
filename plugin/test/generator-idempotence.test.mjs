import test from 'node:test'
import assert from 'node:assert/strict'
import {cpSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'

const ROOT=resolve(new URL('../..',import.meta.url).pathname)
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'hi-generator-ba12-'))
  for(const rel of ['data','roles','skills','scripts'])cpSync(join(ROOT,rel),join(root,rel),{recursive:true})
  cpSync(join(ROOT,'plugin/src/generated'),join(root,'plugin/src/generated'),{recursive:true})
  return root
}
function run(root){
  for(const script of ['generate_plugin_agents.py','generate_methodology_policy.py']){
    const r=spawnSync('python3',[join(root,'scripts',script)],{encoding:'utf8'})
    assert.equal(r.status,0,r.stderr||r.stdout)
  }
}
function generated(root){
  const rels=['plugin/src/generated/role-policy.ts','plugin/src/generated/agent-config.ts','plugin/src/generated/methodology-policy.ts']
  for(const name of readdirSync(join(root,'skills')).filter(x=>x.startsWith('hi-')).sort())rels.push(`skills/${name}/SKILL.md`)
  return Object.fromEntries(rels.map(rel=>[rel,createHash('sha256').update(readFileSync(join(root,rel))).digest('hex')]))
}

test('BA12 generator idempotence: identical canonical inputs produce byte-identical projections on second run',()=>{
  const root=fixture();try{run(root);const first=generated(root);run(root);assert.deepEqual(generated(root),first)}finally{rmSync(root,{recursive:true,force:true})}
})

test('BA12 dependency scope: one RoleContract purpose mutation changes only declared role projections',()=>{
  const root=fixture();try{
    run(root);const before=generated(root)
    const path=join(root,'data/hi-roles.json'),catalog=JSON.parse(readFileSync(path,'utf8'));catalog.roles.find(r=>r.id==='coder').purpose+=' [BA12 mutation]';writeFileSync(path,JSON.stringify(catalog,null,2)+'\n')
    run(root);const after=generated(root);const changed=Object.keys(before).filter(k=>before[k]!==after[k]).sort()
    assert.deepEqual(changed,['plugin/src/generated/agent-config.ts','plugin/src/generated/role-policy.ts'])
  }finally{rmSync(root,{recursive:true,force:true})}
})
