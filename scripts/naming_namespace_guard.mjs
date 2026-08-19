#!/usr/bin/env node
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs'
import {resolve,relative,sep} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'

export const FOREIGN_CANONICAL_BRANDS=[
  {brand:'HHC',pattern:/\bHHC\b/i},
  {brand:'OHO',pattern:/\bOHO\b/i},
  {brand:'DCP',pattern:/\bDCP\b/},
  {brand:'FlowDeck',pattern:/\bFlowDeck\b/i},
  {brand:'Octto',pattern:/\bOctto\b/i},
  {brand:'Orchestra',pattern:/\bOrchestra\b/i},
  {brand:'hiai',pattern:/\bhiai(?:-opencode)?\b/i},
  {brand:'Superpowers',pattern:/\bSuperpowers\b/i},
  {brand:'Skillful',pattern:/\bSkillful\b/i},
  {brand:'opencode-dynamic-context-pruning',pattern:/\bopencode-dynamic-context-pruning\b/i},
  {brand:'opencode-skillful',pattern:/\bopencode-skillful\b/i},
  {brand:'opencode-autopilot-plugin',pattern:/\bopencode-autopilot-plugin\b/i},
]

const CANONICAL_DIRS=[
  'plugin/src/contracts','plugin/src/runtime','plugin/src/config','plugin/src/generated',
  'roles','skills',
]
const CANONICAL_DATA=['data/product.json','data/hi-config-options.json','data/hi-methodologies.json','data/hi-roles.json','data/hi-permission-profiles.json']
const CANONICAL_DOCS=[
  'README.md','docs/README.md','docs/ARCHITECTURE.md','docs/HOSTS.md','docs/HUMAN-DECISIONS.md',
  'docs/INSTALLATION.md','docs/CONFIGURATION.md','docs/locales/tr/CONFIGURATION.md','docs/RELEASE.md','docs/SECURITY-MODEL.md','docs/SKILLS.md','docs/VERIFICATION.md',
]
const TEXT_EXTENSIONS=new Set(['.ts','.js','.mjs','.json','.md','.txt','.yaml','.yml','.toml'])

function rootPath(value){return value instanceof URL?fileURLToPath(value):resolve(String(value))}
function ext(path){const i=path.lastIndexOf('.');return i>=0?path.slice(i).toLowerCase():''}
function unix(path){return path.split(sep).join('/')}
function collectFiles(root,rel){
  const abs=resolve(root,rel);if(!existsSync(abs))return[]
  if(!statSync(abs).isDirectory())return TEXT_EXTENSIONS.has(ext(abs))?[abs]:[]
  const out=[];for(const name of readdirSync(abs)){const child=resolve(abs,name),st=statSync(child);if(st.isDirectory())out.push(...collectFiles(root,unix(relative(root,child))));else if(TEXT_EXTENSIONS.has(ext(child)))out.push(child)}return out
}
function explicitExternalIntegrationPath(rel){
  return /^plugin\/src\/(?:integrations|providers|connectors)\//.test(rel)
}
function opencodeAdapterPath(rel){return /^plugin\/src\/opencode\//.test(rel)}
function strictCanonicalPath(rel){
  return CANONICAL_DATA.includes(rel)||CANONICAL_DOCS.includes(rel)||CANONICAL_DIRS.some(dir=>rel===dir||rel.startsWith(dir+'/'))
}

export function namingViolationsFor(relPath,content){
  const rel=unix(relPath)
  if(!strictCanonicalPath(rel)||explicitExternalIntegrationPath(rel)||opencodeAdapterPath(rel))return[]
  const violations=[]
  for(const entry of FOREIGN_CANONICAL_BRANDS){
    const identifierBrand=entry.brand.replace(/[^A-Za-z0-9]/g,'')
    const identifierPattern=identifierBrand?new RegExp(`\\b${identifierBrand}(?=[A-Z0-9_])`):undefined
    if(entry.pattern.test(rel)||(identifierPattern?.test(rel)??false))violations.push({path:rel,brand:entry.brand,where:'path'})
    entry.pattern.lastIndex=0
    if(entry.pattern.test(content)||(identifierPattern?.test(content)??false))violations.push({path:rel,brand:entry.brand,where:'content'})
    entry.pattern.lastIndex=0
  }
  return violations
}

export function scanCanonicalNaming(rootInput){
  const root=rootPath(rootInput),files=new Set()
  for(const rel of [...CANONICAL_DIRS,...CANONICAL_DATA,...CANONICAL_DOCS])for(const abs of collectFiles(root,rel))files.add(abs)
  const violations=[]
  for(const abs of [...files].sort()){const rel=unix(relative(root,abs));violations.push(...namingViolationsFor(rel,readFileSync(abs,'utf8')))}
  return violations
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
  const root=resolve(process.argv[2]??fileURLToPath(new URL('..',import.meta.url))),violations=scanCanonicalNaming(root)
  if(violations.length){for(const v of violations)console.error(`${v.path}: foreign canonical namespace token ${v.brand} in ${v.where}`);process.exit(1)}
  console.log('HI NAMING NAMESPACE PASS')
}
