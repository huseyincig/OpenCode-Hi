import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import HiPlugin from '../dist/plugin.js'
import {collectRepoContext} from '../dist/runtime/intent/repo-context.js'
import {configuredSkillPaths,discoverSkills} from '../dist/runtime/skills/registry.js'
import {runtimeStatePath} from '../dist/runtime/storage/locations.js'

function temp(prefix){return mkdtempSync(join(tmpdir(),prefix))}
function client(){return {app:{log:async()=>{}},session:{},provider:{}}}
function writeSkill(root,name){const d=join(root,name);mkdirSync(d,{recursive:true});writeFileSync(join(d,'SKILL.md'),`---\nname: ${name}\ndescription: Use when testing external skill discovery.\n---\n\nDo the bounded methodology.\n`)}

test('native project context is worktree-first and plugin state/config persist in the active worktree',async()=>{
  const directory=temp('hi-main-checkout-'),worktree=temp('hi-worktree-')
  try{writeFileSync(join(directory,'package.json'),JSON.stringify({name:'wrong-root'}));writeFileSync(join(worktree,'package.json'),JSON.stringify({name:'active-worktree',scripts:{test:'node --test'}}));const repo=collectRepoContext(directory,{directory,worktree,project:{name:'native-project',vcs:'git'}});assert.equal(repo.root,worktree);const c=client();c.provider.list=async()=>({data:[{id:'opencode-go',models:[{id:'minimax-m3',write:true}]}]});const hooks=await HiPlugin({directory,worktree,project:{name:'native-project',vcs:'git'},client:c});const cfg={};await hooks.config(cfg);await hooks['chat.message']({sessionID:'worktree-parent',message:{role:'user',parts:[{type:'text',text:'fix the README typo'}]}},{parts:[]});assert.equal(existsSync(join(worktree,'.opencode','hi','policy','routing.json')),false);assert.equal(existsSync(join(directory,'.opencode','hi','policy','routing.json')),false);assert.equal(existsSync(runtimeStatePath(worktree)),true);await hooks.dispose?.()}finally{rmSync(directory,{recursive:true,force:true});rmSync(worktree,{recursive:true,force:true})}
})

test('Hi config hook registers packaged native skill path without depending on another plugin',async()=>{
  const root=temp('hi-native-skills-')
  try{const cfg={plugin:['opencode-hi']};const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config(cfg);const paths=configuredSkillPaths(cfg);assert.ok(paths.some(x=>x.endsWith('/skills')||x.endsWith('\\skills')));const found=discoverSkills(root,undefined,paths);assert.ok(found.some(x=>x.name==='hi-test-driven-development'));assert.ok(!('hi_superpowers_status' in hooks.tool));await hooks.dispose?.()}finally{rmSync(root,{recursive:true,force:true})}
})

test('personal/project skill paths coexist without changing Hi-native provider ownership',async()=>{
  const root=temp('hi-skill-coexist-'),extra=join(root,'external-skills')
  try{writeSkill(extra,'project-method');const cfg={skills:{paths:[extra]}};const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config(cfg);const found=discoverSkills(root,join(process.cwd(),'..'),configuredSkillPaths(cfg));assert.equal(found.find(x=>x.name==='project-method')?.provider,'personal');assert.ok(found.some(x=>x.name==='hi-source-driven-development'&&x.provider==='hi'));await hooks.dispose?.()}finally{rmSync(root,{recursive:true,force:true})}
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
    await hooks['chat.message']({sessionID:'native-provider-parent',message:{role:'user',parts:[{type:'text',text:'fix the parser bug with TDD'}]}},{parts:[]})
    const start=JSON.parse(await hooks.tool.hi_task_start.execute({objective:'fix the parser bug with TDD',role:'coder',category:'bug-fix',scope:'src/parser.ts'},{sessionID:'native-provider-parent'}))
    assert.ok(start.skills.includes('hi-test-driven-development'))
    const ledger=JSON.parse(await hooks.tool.hi_ledger.execute({},{sessionID:'native-provider-parent'}))
    const resolved=ledger.find?.(x=>x.event==='skill.resolved'||x.type==='skill.resolved')??ledger.events?.find?.(x=>x.event==='skill.resolved'||x.type==='skill.resolved')
    const outcomes=resolved?.payload?.outcomes??resolved?.data?.payload?.outcomes??[]
    const tdd=outcomes.find(x=>x.name==='hi-test-driven-development')
    assert.equal(tdd?.provider,'hi')
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})
