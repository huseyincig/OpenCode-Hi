export type BrowserBackend='bounded-playwright'|'mcp'

export interface BrowserBackendDecision {
  backend?:BrowserBackend
  reason:string
}

export function resolveBrowserBackend(input:{
  role:string
  browserRequested:boolean
  requested?:string
  localBrowserAvailable:boolean
  semanticCapabilities:readonly string[]
  selectedMcpServers:readonly string[]
}):BrowserBackendDecision{
  const requested=input.requested?.trim()
  if(requested&&requested!=='bounded-playwright'&&requested!=='mcp')throw new Error(`Unsupported browser backend: ${requested}`)
  if(requested&&input.role!=='visual-qa')throw new Error('Explicit browser backend is allowed only for visual-qa tasks')
  if(requested&&!input.browserRequested)throw new Error('Explicit browser backend requires a browser/visual methodology need')
  if(requested==='bounded-playwright'){
    if(!input.localBrowserAvailable)throw new Error('Requested bounded-playwright browser backend is unavailable on the active runtime')
    return{backend:'bounded-playwright',reason:'explicit-local-browser-backend'}
  }
  if(requested==='mcp'){
    if(!input.semanticCapabilities.includes('mcp'))throw new Error('MCP browser backend requires semantic capability mcp')
    if(!input.selectedMcpServers.length)throw new Error('MCP browser backend requires at least one exact selected MCP server')
    return{backend:'mcp',reason:'explicit-task-selected-mcp-browser-backend'}
  }
  if(!input.browserRequested)return{reason:'browser-backend-not-required'}
  if(input.localBrowserAvailable)return{backend:'bounded-playwright',reason:'healthy-bounded-playwright-default'}
  if(input.semanticCapabilities.includes('mcp')&&input.selectedMcpServers.length)return{backend:'mcp',reason:'local-browser-unavailable-task-selected-mcp-fallback'}
  return{reason:'browser-execution-resource-unavailable'}
}
