import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import HhcPlugin from '../dist/plugin.js'
import {collectRepoContext} from '../dist/runtime/intent/repo-context.js'
import {configuredSkillPaths,discoverSkills} from '../dist/runtime/skills/registry.js'

function temp(prefix){return mkdtempSync(join(tmpdir(),prefix))}
function client(){return {app:{log:async()=>{}},session:{},provider:{}}}
function writeSkill(root,name){const d=join(root,name);mkdirSync(d,{recursive:true});writeFileSync(join(d,'SKILL.md'),`---\nname: ${name}\ndescription: Use when testing external skill discovery.\n---\n\nDo the bounded methodology.\n`)}

test('native project context is worktree-first and plugin state/config persist in the active worktree',async()=>{
  const directory=temp('hhc-main-checkout-'),worktree=temp('hhc-worktree-')
  try{writeFileSync(join(directory,'package.json'),JSON.stringify({name:'wrong-root'}));writeFileSync(join(worktree,'package.json'),JSON.stringify({name:'active-worktree',scripts:{test:'node --test'}}));const repo=collectRepoContext(directory,{directory,worktree,project:{name:'native-project',vcs:'git'}});assert.equal(repo.root,worktree);const c=client();c.provider.list=async()=>({data:[{id:'opencode-go',models:[{id:'minimax-m3',write:true}]}]});const hooks=await HhcPlugin({directory,worktree,project:{name:'native-project',vcs:'git'},client:c});const cfg={};await hooks.config(cfg);await hooks['chat.message']({sessionID:'worktree-parent',message:{role:'user',parts:[{type:'text',text:'README typo düzelt'}]}},{parts:[]});assert.equal(existsSync(join(worktree,'.opencode','oho-routing.json')),true);assert.equal(existsSync(join(directory,'.opencode','oho-routing.json')),false);await hooks.dispose?.()}finally{rmSync(directory,{recursive:true,force:true});rmSync(worktree,{recursive:true,force:true})}
})

test('HHC config hook registers packaged native skill path without depending on another plugin',async()=>{
  const root=temp('hhc-native-skills-')
  try{const cfg={plugin:['opencode-hhc-orchestrator']};const hooks=await HhcPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config(cfg);const paths=configuredSkillPaths(cfg);assert.ok(paths.some(x=>x.endsWith('/skills')||x.endsWith('\\skills')));const found=discoverSkills(root,undefined,paths);assert.ok(found.some(x=>x.name==='hhc-test-driven-development'));assert.ok(!('hhc_superpowers_status' in hooks.tool));await hooks.dispose?.()}finally{rmSync(root,{recursive:true,force:true})}
})

test('personal/project skill paths coexist without changing HHC-native provider ownership',async()=>{
  const root=temp('hhc-skill-coexist-'),extra=join(root,'external-skills')
  try{writeSkill(extra,'project-method');const cfg={skills:{paths:[extra]}};const hooks=await HhcPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config(cfg);const found=discoverSkills(root,join(process.cwd(),'..'),configuredSkillPaths(cfg));assert.equal(found.find(x=>x.name==='project-method')?.provider,'personal');assert.ok(found.some(x=>x.name==='hhc-source-driven-development'&&x.provider==='hhc'));await hooks.dispose?.()}finally{rmSync(root,{recursive:true,force:true})}
})

test('default plugin surface does not invent MCP runtime and optional Team tools stay unregistered when disabled',async()=>{
  const root=temp('hhc-tool-economy-')
  try{const cfg={mcp:{userServer:{type:'remote',url:'https://example.invalid/mcp'}}};const before=JSON.stringify(cfg.mcp);const hooks=await HhcPlugin({directory:root,worktree:root,project:{},client:client()});await hooks.config(cfg);assert.equal(JSON.stringify(cfg.mcp),before);for(const name of ['hhc_team_create','hhc_team_message','hhc_team_status','hhc_team_shutdown'])assert.equal(name in hooks.tool,false,name);assert.equal(Object.keys(hooks.tool).some(x=>/^mcp|^hhc_mcp/i.test(x)),false);await hooks.dispose?.()}finally{rmSync(root,{recursive:true,force:true})}
})

test('non-git filesystem-root worktree sentinel does not collapse HHC state/config outside the active directory',async()=>{
  const directory=temp('hhc-nongit-project-')
  const sentinel=new URL('file:///').pathname
  try{
    writeFileSync(join(directory,'package.json'),JSON.stringify({name:'nongit-project'}))
    const repo=collectRepoContext(directory,{directory,worktree:sentinel,project:{name:'nongit-project'}})
    assert.equal(repo.root,directory)
    const c=client();c.provider.list=async()=>({data:[{id:'opencode-go',models:[{id:'minimax-m3',write:true}]}]})
    const hooks=await HhcPlugin({directory,worktree:sentinel,project:{name:'nongit-project'},client:c})
    const cfg={};await hooks.config(cfg)
    await hooks['chat.message']({sessionID:'nongit-parent',message:{role:'user',parts:[{type:'text',text:'README typo düzelt'}]}},{parts:[]})
    assert.equal(existsSync(join(directory,'.opencode','oho-routing.json')),true)
    assert.equal(existsSync(join(directory,'.opencode','.oho','runtime-state.json')),true)
    await hooks.dispose?.()
  }finally{rmSync(directory,{recursive:true,force:true})}
})


test('plugin-wired worker skill resolution preserves HHC-native provider provenance',async()=>{
  const root=temp('hhc-native-provider-');let child=0
  const c={app:{log:async()=>{}},provider:{list:async()=>({data:[]})},session:{
    create:async()=>({data:{id:`native-child-${++child}`}}),
    promptAsync:async()=>({data:{}}),diff:async()=>({data:[]}),abort:async()=>({data:{}})
  }}
  try{
    const hooks=await HhcPlugin({directory:root,worktree:root,project:{name:'native-provider'},client:c})
    const cfg={};await hooks.config(cfg)
    await hooks['chat.message']({sessionID:'native-provider-parent',message:{role:'user',parts:[{type:'text',text:'TDD ile parser bug düzelt'}]}},{parts:[]})
    const start=JSON.parse(await hooks.tool.hhc_task_start.execute({objective:'TDD ile parser bug düzelt',role:'coder',category:'bug-fix',scope:'src/parser.ts'},{sessionID:'native-provider-parent'}))
    assert.ok(start.skills.includes('hhc-test-driven-development'))
    const ledger=JSON.parse(await hooks.tool.hhc_ledger.execute({},{sessionID:'native-provider-parent'}))
    const resolved=ledger.find?.(x=>x.event==='skill.resolved'||x.type==='skill.resolved')??ledger.events?.find?.(x=>x.event==='skill.resolved'||x.type==='skill.resolved')
    const outcomes=resolved?.payload?.outcomes??resolved?.data?.payload?.outcomes??[]
    const tdd=outcomes.find(x=>x.name==='hhc-test-driven-development')
    assert.equal(tdd?.provider,'hhc')
    await hooks.dispose?.()
  }finally{rmSync(root,{recursive:true,force:true})}
})
