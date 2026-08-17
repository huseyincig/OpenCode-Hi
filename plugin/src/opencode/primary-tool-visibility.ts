function record(value:unknown):Record<string,unknown>|undefined{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined}

/**
 * Hi tools that are registered for host/user access but are not part of the
 * provider-visible built-in primary execution surface. Browser tools are
 * child-visual-only by runtime ownership. Diagnostics remain callable through
 * the plugin surface but do not need to consume model tool-schema context.
 */
export const HI_PRIMARY_HIDDEN_TOOL_IDS=[
  'hi_doctor','hi_status','hi_metrics','hi_ledger','hi_readiness',
  'hi_browser_open','hi_browser_navigate','hi_browser_click','hi_browser_type',
  'hi_browser_inspect','hi_browser_screenshot','hi_browser_wait','hi_browser_close',
] as const

export interface PrimaryToolVisibilityProjectionResult{
  targets:string[]
  defaultHidden:string[]
  explicitPreserved:string[]
  diagnostics:string[]
}

/**
 * OpenCode 1.18.x adapter optimization. The host's agent `tools:false` leaves
 * remove those schemas from the provider-visible catalog. We narrow only Hi's
 * own impossible/diagnostic leaves and never choose the host primary agent.
 * Explicit host/user choices win, including an explicit `true`.
 */
export function projectBuiltinPrimaryHiToolVisibility(config:Record<string,unknown>):PrimaryToolVisibilityProjectionResult{
  const existingAgents=record(config.agent),agents=existingAgents??{},targets:string[]=[],defaultHidden:string[]=[],explicitPreserved:string[]=[],diagnostics:string[]=[]
  for(const name of ['build','plan']){
    const current=agents[name]
    if(current!==undefined&&!record(current)){diagnostics.push(`primary-tool-visibility-skipped:${name}:agent-shape`);continue}
    const agent=record(current)??{}
    const existingTools=agent.tools
    if(existingTools!==undefined&&!record(existingTools)){diagnostics.push(`primary-tool-visibility-skipped:${name}:tools-shape`);continue}
    const tools=record(existingTools)??{}
    for(const id of HI_PRIMARY_HIDDEN_TOOL_IDS){
      if(Object.prototype.hasOwnProperty.call(tools,id)){explicitPreserved.push(`${name}:${id}`);continue}
      tools[id]=false;defaultHidden.push(`${name}:${id}`)
    }
    agent.tools=tools;agents[name]=agent;targets.push(name)
  }
  if(!existingAgents&&targets.length)config.agent=agents
  return{targets,defaultHidden,explicitPreserved,diagnostics}
}
