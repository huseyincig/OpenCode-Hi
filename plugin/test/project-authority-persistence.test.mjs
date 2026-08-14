import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProjectAuthorityStore, applyProjectAuthorityPermissions, authorityClassForPatterns } from '../dist/runtime/safety/project-authority.js'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { startAssessedMission } from './helpers/semantic.mjs'
import { createToolBeforeHook } from '../dist/hooks/tool-before.js'

test('native always approval persists normal release-chain permission across project restarts',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-auth-'))
  try{
    const a=new ProjectAuthorityStore(root)
    assert.equal(a.has('git-push'),false)
    a.grant('git-push')
    const b=new ProjectAuthorityStore(root)
    assert.equal(b.has('git-push'),true)
    const cfg={permission:{bash:{'*':'allow'}}}
    applyProjectAuthorityPermissions(cfg,b)
    assert.equal(cfg.permission.bash['git push *'],'allow')
    assert.equal(cfg.permission.bash['gh release create *'],'ask')
    assert.equal(cfg.permission.bash['git push --force*'],'ask')
    assert.equal(cfg.permission.bash['git push -f *'],'ask')
    const saved=JSON.parse(readFileSync(join(root,'.opencode','hi','policy','authority.json'),'utf8'))
    assert.equal(saved.schema,1)
    assert.ok(saved.grants['git-push'])
  } finally { rmSync(root,{recursive:true,force:true}) }
})

test('without persistent grant, risky external effects use native OpenCode ask instead of Hi chat approval',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-auth-'))
  try{
    const cfg={permission:{bash:{'*':'allow'}}}
    applyProjectAuthorityPermissions(cfg,new ProjectAuthorityStore(root))
    assert.equal(cfg.permission.bash['git push *'],'ask')
    assert.equal(cfg.permission.bash['gh release create *'],'ask')
    assert.equal(cfg.permission.bash['npm publish*'],'ask')
    assert.equal(cfg.permission.bash['yarn npm publish*'],'ask')
    assert.equal(cfg.permission.bash['kubectl delete *'],'ask')
    const store=new MissionStore(root),m=startAssessedMission(store,'s','push the release',{task_kind:'release-readiness',scope:'external',risk:'authority-boundary',requested_external_actions:['git-push']})
    await createToolBeforeHook(store)({sessionID:'s',tool:'bash',args:{command:'git push origin main',cwd:root}},{args:{command:'git push origin main',cwd:root}})
    assert.ok(m.authority?.executing,'reaching tool-before means OpenCode native permission resolution already completed')
    assert.equal(m.authority?.pending,undefined,'Hi must not create a second text approval gate')
  } finally { rmSync(root,{recursive:true,force:true}) }
})

test('user explicit deny is never weakened by persistent Hi grant',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-auth-'))
  try{
    const st=new ProjectAuthorityStore(root);st.grant('git-push')
    const cfg={permission:{bash:{'*':'allow','git *':'deny'}}}
    applyProjectAuthorityPermissions(cfg,st)
    assert.equal(cfg.permission.bash['git push *'],undefined)
    assert.equal(cfg.permission.bash['gh release create *'],'ask')
  } finally { rmSync(root,{recursive:true,force:true}) }
})

test('native permission patterns map to bounded project authority classes',()=>{
  assert.equal(authorityClassForPatterns(['git push origin *']),'git-push')
  assert.equal(authorityClassForPatterns(['gh release create *']),'release-create')
  assert.equal(authorityClassForPatterns(['yarn npm publish *']),'package-publish')
  assert.equal(authorityClassForPatterns(['kubectl delete *']),'deploy')
  assert.equal(authorityClassForPatterns(['npm publish*']),'package-publish')
  assert.equal(authorityClassForPatterns(['rm -rf *']),undefined)
})

test('plugin persists native always reply and applies it on the next project boot',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-auth-plugin-'))
  try{
    const {default:HiPlugin}=await import('../dist/plugin.js')
    const client={app:{log:async()=>{}},session:{abort:async()=>({data:{}})},provider:{}}
    let hooks=await HiPlugin({directory:root,worktree:root,project:{},client})
    const first={permission:{bash:{'*':'allow'}}}
    await hooks.config(first)
    assert.equal(first.permission.bash['git push *'],'ask')
    await hooks['chat.message']({sessionID:'s',message:{role:'user',parts:[{type:'text',text:'release and push'}]}},{parts:[]})
    await hooks.event({event:{type:'permission.asked',properties:{id:'per-1',sessionID:'s',permission:'bash',patterns:['git push origin *'],always:['git push origin *']}}})
    await hooks.event({event:{type:'permission.replied',properties:{id:'per-1',sessionID:'s',response:'always'}}})
    await hooks.dispose?.()

    hooks=await HiPlugin({directory:root,worktree:root,project:{},client})
    const second={permission:{bash:{'*':'allow'}}}
    await hooks.config(second)
    assert.equal(second.permission.bash['git push *'],'allow')
    assert.equal(second.permission.bash['gh release create *'],'ask')
    assert.equal(second.permission.bash['git push --force*'],'ask')
    await hooks.dispose?.()
  } finally { rmSync(root,{recursive:true,force:true}) }
})


test('global ask does not spam autonomous local commit/merge steps; external push remains the single authority hinge',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-auth-'))
  try{
    const cfg={permission:{bash:{'*':'ask'}}}
    applyProjectAuthorityPermissions(cfg,new ProjectAuthorityStore(root))
    assert.equal(cfg.permission.bash['git add *'],'allow')
    assert.equal(cfg.permission.bash['git commit *'],'allow')
    assert.equal(cfg.permission.bash['git merge *'],'allow')
    assert.equal(cfg.permission.bash['git tag *'],'allow')
    assert.equal(cfg.permission.bash['git push *'],'ask')
    const st=new ProjectAuthorityStore(root);st.grant('git-push')
    const next={permission:{bash:{'*':'ask'}}};applyProjectAuthorityPermissions(next,st)
    assert.equal(next.permission.bash['git commit *'],'allow')
    assert.equal(next.permission.bash['git merge *'],'allow')
    assert.equal(next.permission.bash['git push *'],'allow')
    assert.equal(next.permission.bash['gh release create *'],'ask')
    assert.equal(next.permission.bash['git push --force*'],'ask')
  } finally { rmSync(root,{recursive:true,force:true}) }
})


test('release-create persistent authority is distinct from git-push authority',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-auth-'))
  try{
    const st=new ProjectAuthorityStore(root);st.grant('release-create')
    const cfg={permission:{bash:{'*':'allow'}}};applyProjectAuthorityPermissions(cfg,st)
    assert.equal(cfg.permission.bash['gh release create *'],'allow')
    assert.equal(cfg.permission.bash['git push *'],'ask')
  } finally { rmSync(root,{recursive:true,force:true}) }
})
