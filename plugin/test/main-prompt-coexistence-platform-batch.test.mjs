import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import HiPlugin from '../dist/plugin.js'
import { assessPluginMission } from './helpers/semantic.mjs'
import {collectRepoContext} from '../dist/runtime/intent/repo-context.js'
import {runtimeStatePath} from '../dist/runtime/storage/locations.js'

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..')

function temp(prefix){return mkdtempSync(join(tmpdir(),prefix))}
function client(){return {app:{log:async()=>{}},session:{},provider:{}}}
function writeSkill(root,name){const d=join(root,name);mkdirSync(d,{recursive:true});writeFileSync(join(d,'SKILL.md'),`---\nname: ${name}\ndescription: Use when testing external skill discovery.\n---\n\nDo the bounded methodology.\n`)}

test('native project context is worktree-first and plugin state/config persist in the active worktree',async()=>{
  const directory=temp('hi-main-checkout-'),worktree=temp('hi-worktree-')
  try{writeFileSync(join(directory,'package.json'),JSON.stringify({name:'wrong-root'}));writeFileSync(join(worktree,'package.json'),JSON.stringify({name:'active-worktree',scripts:{test:'node --test'}}));const repo=collectRepoContext(directory,{directory,worktree,project:{name:'native-project',vcs:'git'}});assert.equal(repo.root,worktree);const c=client();c.provider.list=async()=>({data:[{id:'opencode-go',models:[{id:'minimax-m3',write:true}]}]});const hooks=await HiPlugin({directory,worktree,project:{name:'native-project',vcs:'git'},client:c});const cfg={};await hooks.config(cfg);await hooks['chat.message']({sessionID:'worktree-parent',message:{role:'user',parts:[{type:'text',text:'fix the README typo'}]}},{parts:[]});assert.equal(existsSync(join(worktree,'.opencode','hi','policy','routing.json')),false);assert.equal(existsSync(join(directory,'.opencode','hi','policy','routing.json')),false);assert.equal(existsSync(runtimeStatePath(worktree)),true);await hooks.dispose?.()}finally{rmSync(directory,{recursive:true,force:true});rmSync(worktree,{recursive:true,force:true})}
})

test('Hi config hook registers packaged native skill path without depending on another plugin',async()=>{
  const root=temp('hi-native-skills-')
  try{const cfg={plugin:['opencode-hi']};const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config(cfg);const paths=cfg.skills?.paths??[];assert.ok(paths.some(x=>x.endsWith('/skills')||x.endsWith('\\skills')),'Hi packaged skill root is projected for native OpenCode discovery');assert.ok(!('hi_superpowers_status' in hooks.tool));await hooks.dispose?.()}finally{rmSync(root,{recursive:true,force:true})}
})

test('personal/project skill paths coexist without changing Hi-native provider ownership',async()=>{
  const root=temp('hi-skill-coexist-'),extra=join(root,'external-skills')
  try{writeSkill(extra,'project-method');const cfg={skills:{paths:[extra]}};const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config(cfg);assert.ok(cfg.skills.paths.includes(extra),'external native skill path is preserved');assert.ok(cfg.skills.paths.some(x=>x===join(repoRoot,'skills')),'Hi packaged path is appended without indexing the external skill');await hooks.dispose?.()}finally{rmSync(root,{recursive:true,force:true})}
})

test('default plugin surface does not invent MCP runtime and optional Team tools stay unregistered when disabled',async()=>{
  const root=temp('hi-tool-economy-')
  try{const cfg={mcp:{userServer:{type:'remote',url:'https://example.invalid/mcp'}}};const before=JSON.stringify(cfg.mcp);const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config(cfg);assert.equal(JSON.stringify(cfg.mcp),before);for(const name of ['hi_team_create','hi_team_message','hi_team_status','hi_team_shutdown'])assert.equal(name in hooks.tool,false,name);assert.equal(Object.keys(hooks.tool).some(x=>/^mcp|^hi_mcp/i.test(x)),false);await hooks.dispose?.()}finally{rmSync(root,{recursive:true,force:true})}
})

test('non-git filesystem-root worktree sentinel does not collapse Hi state/config outside the active directory',async()=>{
  const directory=temp('hi-nongit-project-')
  const sentinel=new URL('file:///').pathname
  try{
    writeFileSync(join(directory,'package.json'),JSON.stringify({name:'nongit-project'}))
    const repo=collectRepoContext(directory,{directory,worktree:sentinel,project:{name:'nongit-project'}})
    assert.equal(repo.root,directory)
    const c=client();c.provider.list=async()=>({data:[{id:'opencode-go',models:[{id:'minimax-m3',write:true}]}]})
    const hooks=await HiPlugin({directory,worktree:sentinel,project:{name:'nongit-project'},client:c})
    const cfg={};await hooks.config(cfg)
    await hooks['chat.message']({sessionID:'nongit-parent',message:{role:'user',parts:[{type:'text',text:'fix the README typo'}]}},{parts:[]})
    assert.equal(existsSync(join(directory,'.opencode','hi','policy','routing.json')),false)
    assert.equal(existsSync(join(directory,'.opencode','hi','runtime','runtime-state.json')),false)
    assert.equal(existsSync(runtimeStatePath(directory)),true)
    await hooks.dispose?.()
  }finally{rmSync(directory,{recursive:true,force:true})}
})


test('plugin-wired worker skill resolution preserves Hi-native provider provenance',async()=>{
  const root=temp('hi-native-provider-');let child=0
  const c={app:{log:async()=>{}},provider:{list:async()=>({data:[]})},session:{
    create:async()=>({data:{id:`native-child-${++child}`}}),
    promptAsync:async()=>({data:{}}),diff:async()=>({data:[]}),abort:async()=>({data:{}})
  }}
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{name:'native-provider'},client:c})
    const cfg={};await hooks.config(cfg)
    await hooks['chat.message']({sessionID:'native-provider-parent',message:{role:'user',parts:[{type:'text',text:'fix the parser bug with TDD'}]}},{parts:[]}); await assessPluginMission(hooks,'native-provider-parent',{task_kind:'bug-fix',required_capabilities:['implementation'],likely_targets:['src/parser.ts'],intent_signals:['intent.tdd']})
    const start=JSON.parse(await hooks.tool.hi_task_start.execute({objective:'fix the parser bug with TDD',role:'coder',category:'bug-fix',scope:'Only src/parser.ts may be modified.',dependencies:'none'},{sessionID:'native-provider-parent'}))
    assert.ok(start.methodologies.includes('hi-test-driven-development'))
    const listed=JSON.parse(await hooks.tool.hi_task_list.execute({},{sessionID:'native-provider-parent'}));assert.deepEqual(listed.find(x=>x.task.id===start.task_id)?.task.dependencies,[]);assert.deepEqual(listed.find(x=>x.task.id===start.task_id)?.task.scope,['src/parser.ts'])
    const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({},{sessionID:'native-provider-parent'}))
    const resolved=ledger.find?.(x=>x.event==='skill.resolved'||x.type==='skill.resolved')??ledger.events?.find?.(x=>x.event==='skill.resolved'||x.type==='skill.resolved')
    const outcomes=resolved?.payload?.outcomes??resolved?.data?.payload?.outcomes??[]
    const tdd=outcomes.find(x=>x.name==='hi-test-driven-development')
    assert.equal(tdd?.provider,'hi')
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('V2-shaped config fails with explicit adapter diagnostic and is not backfilled with V1 Hi keys',async()=>{
  const root=temp('hi-v2-composition-')
  try{
    const cfg={plugins:['external'],agents:{external:{description:'keep'}},permissions:[{action:'bash',resource:'*',effect:'ask'}],providers:{p:{custom:true}},skills:['./external-skills'],mcp:{servers:{x:{type:'remote'}}}},before=JSON.stringify(cfg)
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()})
    await assert.rejects(()=>hooks.config(cfg),/v2-domain-transform-required/)
    assert.equal(JSON.stringify(cfg),before,'failed compatibility projection must leave shared V2 config untouched')
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('hi_task_start scope prose fails closed when it ambiguously names multiple project paths',async()=>{
  const root=temp('hi-scope-ambiguous-');let child=0
  const c={app:{log:async()=>{}},provider:{list:async()=>({data:[]})},session:{create:async()=>({data:{id:`scope-child-${++child}`}}),promptAsync:async()=>({data:{}}),diff:async()=>({data:[]}),abort:async()=>({data:{}})}}
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{name:'scope-ambiguous'},client:c});const cfg={};await hooks.config(cfg)
    await hooks['chat.message']({sessionID:'scope-parent',message:{role:'user',parts:[{type:'text',text:'fix one bounded file'}]}},{parts:[]});await assessPluginMission(hooks,'scope-parent',{task_kind:'bug-fix',required_capabilities:['implementation']})
    const out=await hooks.tool.hi_task_start.execute({objective:'bounded change',role:'coder',scope:'Only src/a.ts may be modified; do not modify src/b.ts'},{sessionID:'scope-parent'})
    assert.match(String(out),/scope prose must identify exactly one bounded project-relative path/i)
    const listed=JSON.parse(await hooks.tool.hi_task_list.execute({},{sessionID:'scope-parent'}));assert.deepEqual(listed,[]);assert.equal(child,0)
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('hi_task_start canonicalizes semicolon-separated multi-path scope before scheduler admission',async()=>{
  const root=temp('hi-scope-semicolon-');let child=0
  const c={app:{log:async()=>{}},provider:{list:async()=>({data:[]})},session:{create:async()=>({data:{id:`scope-child-${++child}`}}),promptAsync:async()=>({data:{}}),diff:async()=>({data:[]}),abort:async()=>({data:{}})}}
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{name:'scope-semicolon'},client:c});const cfg={};await hooks.config(cfg)
    await hooks['chat.message']({sessionID:'scope-parent-semicolon',message:{role:'user',parts:[{type:'text',text:'fix two bounded files'}]}},{parts:[]});await assessPluginMission(hooks,'scope-parent-semicolon',{task_kind:'implementation',scope:'multi-file',ambiguity:'resolvable',dependency_class:'independent-multi',required_capabilities:['implementation','multi-stream-delegation']})
    const first=JSON.parse(await hooks.tool.hi_task_start.execute({objective:'bounded A',role:'coder',scope:'src/alpha.js;src/shared.js'},{sessionID:'scope-parent-semicolon'}))
    const second=JSON.parse(await hooks.tool.hi_task_start.execute({objective:'bounded B',role:'coder',scope:'src/beta.js;src/shared.js'},{sessionID:'scope-parent-semicolon'}))
    assert.ok(first.task_id);assert.equal(second.readiness,'WAIT');const listed=JSON.parse(await hooks.tool.hi_task_list.execute({},{sessionID:'scope-parent-semicolon'}));assert.equal(listed.length,2)
    assert.deepEqual(listed[0].task.scope,['src/alpha.js','src/shared.js']);assert.deepEqual(listed[1].task.scope,['src/beta.js','src/shared.js'])
    assert.equal(listed[0].task.status,'running');assert.equal(listed[1].task.status,'queued');assert.equal(child,1,'overlapping mutable scope must not start a second child concurrently')
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('hi_task_start accepts OpenCode nested input shape without losing role category scope or obligation binding',async()=>{
  const root=temp('hi-start-nested-input-');let child=0
  const c={app:{log:async()=>{}},provider:{list:async()=>({data:[]})},session:{create:async()=>({data:{id:`nested-child-${++child}`}}),promptAsync:async()=>({data:{}}),diff:async()=>({data:[]}),abort:async()=>({data:{}})}}
  try{
    const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:c});await hooks.config({})
    const sid='nested-parent';await hooks['chat.message']({sessionID:sid,message:{role:'user',parts:[{type:'text',text:'Change src/a.ts'}]}},{parts:[]});await assessPluginMission(hooks,sid,{task_kind:'implementation',scope:'local',risk:'low',required_capabilities:['implementation'],likely_verification:[],likely_targets:['src/a.ts']})
    const out=JSON.parse(await hooks.tool.hi_task_start.execute({input:{objective:'bounded change',role:'coder',category:'quick',scope:'src/a.ts',obligation_ids:'o-implementation'}},{sessionID:sid}))
    assert.ok(out.task_id);assert.equal(out.control.action,'WAIT')
    const listed=JSON.parse(await hooks.tool.hi_task_list.execute({},{sessionID:sid})),task=listed.find(x=>x.task.id===out.task_id)?.task
    assert.equal(task.role,'coder');assert.equal(task.category,'quick');assert.deepEqual(task.scope,['src/a.ts']);assert.deepEqual(task.requiredEvidence,[]);assert.deepEqual(task.obligation_ids,['o-implementation'])
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})
