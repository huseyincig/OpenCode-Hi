import { existsSync } from 'node:fs'
import { resolveHiConfigWithReport } from '../config/resolver.js'
import { bindHiOpenCodeAgents } from './agent-binding.js'
import { PACKAGED_HI_AGENTS } from '../generated/agent-config.js'
import { applyAdmittedProjectMethodologyPermissions } from '../runtime/methodology/host-permissions.js'
import { applyProjectAuthorityPermissions } from '../runtime/safety/project-authority.js'
import { createChatMessageHook } from '../hooks/chat-message.js'
import { createMessagesTransformHook } from '../hooks/messages-transform.js'
import { createSystemTransformHook } from '../hooks/system-transform.js'
import { createToolBeforeHook } from '../hooks/tool-before.js'
import { createToolAfterHook } from '../hooks/tool-after.js'
import { appendLedger } from '../runtime/ledger/ledger.js'
import type { PluginRuntimeState } from '../runtime/application/hi-tool-surface.js'
import type { HostPort } from './host-port.js'
import type { createRuntimeServices } from '../runtime/application/runtime-services.js'
import type { ProjectAuthorityStore } from '../runtime/safety/project-authority.js'
import type { RuntimeEventController } from '../runtime/application/runtime-event-controller.js'

export function createOpenCodeHooks(input:{state:PluginRuntimeState;host:HostPort;services:ReturnType<typeof createRuntimeServices>;projectRoot:string;packagedSkillsDir:string;projectAuthority:ProjectAuthorityStore;toolSurface:Record<string,unknown>;reconfigureToolSurface:()=>void;eventController:RuntimeEventController;instanceLease:{release:()=>void}}){
  const {state,host,services,projectRoot,packagedSkillsDir,projectAuthority,toolSurface,reconfigureToolSurface,eventController,instanceLease}=input
  const {store,background,persistence,tasks,teams,experimental,eventSink}=services
  return {
    name:'opencode-hi',
    tool:toolSurface,
    config:async(opencodeConfig:Record<string,unknown>)=>{state.hostConfig=opencodeConfig;const resolved=resolveHiConfigWithReport(opencodeConfig.hi,projectRoot);state.config=resolved.config;state.configResolution=resolved.report;opencodeConfig.hi=state.config as unknown as Record<string,unknown>
      if(existsSync(packagedSkillsDir)){const skills=(opencodeConfig.skills&&typeof opencodeConfig.skills==='object'?opencodeConfig.skills:{} ) as Record<string,unknown>;const paths=Array.isArray(skills.paths)?skills.paths as unknown[]:[];if(!paths.includes(packagedSkillsDir))paths.push(packagedSkillsDir);skills.paths=paths;opencodeConfig.skills=skills}
      const agentCollisions=bindHiOpenCodeAgents(opencodeConfig,PACKAGED_HI_AGENTS as unknown as Record<string,unknown>);if(agentCollisions.length)throw new Error(`OpenCode-Hi agent binding collision: ${agentCollisions.join(', ')}. Canonical Hi role names must resolve to the packaged Hi OpenCode agent contract.`);const requestedPrimary=state.config.primaryMode==='manager'?'manager':state.config.primaryMode==='working-manager'?'working-manager':undefined;if(requestedPrimary&&opencodeConfig.default_agent!==undefined&&opencodeConfig.default_agent!==requestedPrimary)throw new Error(`OpenCode-Hi primary binding conflict: primaryMode=${requestedPrimary} but OpenCode default_agent=${String(opencodeConfig.default_agent)}.`);if(opencodeConfig.default_agent===undefined)opencodeConfig.default_agent=requestedPrimary??'working-manager';if(opencodeConfig.subagent_depth===undefined)opencodeConfig.subagent_depth=1
      applyAdmittedProjectMethodologyPermissions(opencodeConfig,projectRoot)
      applyProjectAuthorityPermissions(opencodeConfig,projectAuthority)
      services.scopedStores.skillCatalog.invalidate()
      reconfigureToolSurface()
    },
    'chat.message':async(input:any,output:any)=>{try{const messageSession=String(input?.sessionID??input?.sessionId??'');if(messageSession&&background.list().some((w:any)=>w.session_id===messageSession)){await host.log('debug','Hi child chat message ignored by parent intent hook',{session_id:messageSession});return}if(!host.getModels().length)void host.refreshRuntimeInventory('chat-message');await createChatMessageHook(store,async(sid,text)=>{const m=store.get(sid);if(!m)return;const teamsPaused=teams.adoptSemanticGeneration(m),workersPaused=await tasks.pauseForSemanticAssessment(m);appendLedger(m,'semantic.execution-quarantined',{payload:{revision:m.identity.semantic_assessment.revision,workers:workersPaused,teams:teamsPaused,preview:text.slice(0,180)}})})(input,output)}finally{persistence.save(store.all())}},
    'experimental.chat.messages.transform':createMessagesTransformHook(store,background),
    'experimental.chat.system.transform':createSystemTransformHook(store,background,projectRoot),
    'experimental.session.compacting':async(input:any,output:any)=>{try{await experimental.compacting()(input,output)}finally{persistence.save(store.all())}},
    'tool.execute.before':async(input:any,output:any)=>{try{await createToolBeforeHook(store,background,projectRoot)(input,output)}finally{persistence.save(store.all())}},
    'tool.execute.after':async(input:any,output:any)=>{try{await createToolAfterHook(store,background,eventSink,projectRoot)(input,output)}finally{persistence.save(store.all())}},
    dispose:async()=>{try{for(const m of store.all())if(m.identity.status==='active'){await teams.shutdownMission(m);await tasks.cancelAll(m)}persistence.markCleanShutdown(store.all())}finally{instanceLease.release()}},
    event:(input:any)=>eventController.handle(input),
  }
}
