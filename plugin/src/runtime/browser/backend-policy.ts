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
  if(requested&&!input.browserRequested)throw new Error('Explicit browser backend requires a browser/visual task contract')
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


function localHost(hostname:string):boolean{return hostname==='localhost'||hostname==='127.0.0.1'||hostname==='::1'||hostname==='[::1]'}
export function normalizeBrowserAllowedOrigins(values:readonly string[]):string[]{
  const out:string[]=[]
  for(const raw of values){
    let url:URL;try{url=new URL(String(raw).trim())}catch{throw new Error(`Browser allowed origin must be an absolute http(s) URL: ${raw}`)}
    if(!['http:','https:'].includes(url.protocol))throw new Error(`Browser allowed origin must use http(s): ${raw}`)
    if(url.username||url.password)throw new Error('Browser allowed origin cannot contain credentials')
    if(!localHost(url.hostname))throw new Error(`Browser allowed origin is outside supported local scope: ${url.origin}`)
    out.push(url.origin)
  }
  return[...new Set(out)].slice(0,8)
}

export function browserOriginsFromTargets(targets:readonly string[]):string[]{
  const origins:string[]=[]
  for(const raw of targets){
    const text=String(raw)
    for(const match of text.matchAll(/https?:\/\/[^\s\]})>'"`]+/gi)){
      const candidate=match[0].replace(/[.,;:!?]+$/,'')
      try{const url=new URL(candidate);if(localHost(url.hostname))origins.push(url.origin)}catch{}
    }
  }
  return normalizeBrowserAllowedOrigins(origins)
}
