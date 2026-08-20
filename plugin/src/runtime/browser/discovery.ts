import {existsSync,readdirSync} from 'node:fs'
import {homedir,platform} from 'node:os'
import {join} from 'node:path'

function cacheCandidates(root:string):string[]{
  try{return readdirSync(root,{withFileTypes:true}).filter(x=>x.isDirectory()&&/^chromium-/.test(x.name)).flatMap(x=>[
    join(root,x.name,'chrome-linux','chrome'),
    join(root,x.name,'chrome-linux64','chrome'),
    join(root,x.name,'chrome-win','chrome.exe'),
    join(root,x.name,'chrome-mac','Chromium.app','Contents','MacOS','Chromium'),
  ])}catch{return[]}
}
export function defaultPlaywrightCacheRoots(extraRoots:readonly string[]=[]):string[]{
  const playwrightRoot=process.env.PLAYWRIGHT_BROWSERS_PATH?.trim(),home=homedir(),os=platform(),roots:string[]=[...extraRoots.map(x=>x.trim()).filter(Boolean)]
  if(playwrightRoot&&playwrightRoot!=='0')roots.push(playwrightRoot)
  if(process.env.XDG_CACHE_HOME?.trim())roots.push(join(process.env.XDG_CACHE_HOME.trim(),'ms-playwright'))
  if(process.env.LOCALAPPDATA?.trim())roots.push(join(process.env.LOCALAPPDATA.trim(),'ms-playwright'))
  if(os==='darwin')roots.push(join(home,'Library','Caches','ms-playwright'));else if(os!=='win32')roots.push(join(home,'.cache','ms-playwright'))
  return[...new Set(roots)]
}
export function discoverChromiumInRoots(roots:readonly string[],exists:(path:string)=>boolean=existsSync):string|undefined{return[...new Set(roots)].flatMap(cacheCandidates).find(exists)}
export function discoverPlaywrightChromium(exists:(path:string)=>boolean=existsSync,extraRoots:readonly string[]=[]):string|undefined{
  const explicit=process.env.HI_BROWSER_EXECUTABLE?.trim()
  if(explicit&&exists(explicit))return explicit
  return discoverChromiumInRoots(defaultPlaywrightCacheRoots(extraRoots),exists)
}
