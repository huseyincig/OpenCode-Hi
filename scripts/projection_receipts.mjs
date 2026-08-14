import {readFileSync,readdirSync} from 'node:fs'
import {join,relative} from 'node:path'
import {createProjectionReceipt} from '../plugin/dist/contracts/provenance.js'

const json=p=>JSON.parse(readFileSync(p,'utf8'))
const text=p=>readFileSync(p,'utf8')
const rel=(root,p)=>relative(root,p).replaceAll('\\','/')

function skillAuthored(path){
  const source=text(path)
  const title=source.match(/^#\s+(.+)$/m)?.[1]?.trim()
  const method=source.match(/^## Method\s*\n\n([\s\S]*?)\n\n## Ownership boundary/m)?.[1]?.trim()
  if(!title||!method)throw new Error(`${path}: missing authored title/method input`)
  return {title,method}
}

export function buildProjectionReceipts(root){
  const roleCatalog=json(join(root,'data','hi-roles.json'))
  const methodologyCatalog=json(join(root,'data','hi-methodologies.json'))
  const permissionCatalog=json(join(root,'data','hi-permission-profiles.json'))
  const roleGuidance={}
  for(const name of readdirSync(join(root,'roles')).filter(x=>x.endsWith('.md')).sort())roleGuidance[name.slice(0,-3)]=text(join(root,'roles',name))
  const receipts=[]
  const add=(projectionSchema,sourceContracts,generatorId,outputPath)=>receipts.push(createProjectionReceipt({
    projectionSchema,sourceContracts,generatorId,generatorVersion:'1',outputPath,outputContent:text(join(root,outputPath))
  }))
  add('hi.permission-policy.v1',[{id:'hi.permission.catalog',contract:permissionCatalog}],'hi.permission-policy.generator','plugin/src/generated/permission-policy.ts')
  add('hi.role-policy.v1',[{id:'hi.role.catalog',contract:roleCatalog}],'hi.role-policy.generator','plugin/src/generated/role-policy.ts')
  add('hi.agent-config.v1',[{id:'hi.role.catalog',contract:roleCatalog},{id:'hi.permission.catalog',contract:permissionCatalog},{id:'hi.methodology.catalog',contract:methodologyCatalog},{id:'hi.role.guidance',contract:roleGuidance}],'hi.agent-config.generator','plugin/src/generated/agent-config.ts')
  add('hi.methodology-policy.v1',[{id:'hi.methodology.catalog',contract:methodologyCatalog},{id:'hi.role.catalog',contract:roleCatalog}],'hi.methodology-policy.generator','plugin/src/generated/methodology-policy.ts')
  const profileByName=new Map(methodologyCatalog.profiles.map(p=>[p.name,p]))
  for(const name of [...profileByName.keys()].sort()){
    const output=join(root,'skills',name,'SKILL.md')
    add('hi.skill-projection.v1',[{id:`hi.methodology.${name}`,contract:profileByName.get(name)},{id:`hi.method.${name}`,contract:skillAuthored(output)}],'hi.methodology-skill.generator',rel(root,output))
  }
  return receipts.sort((a,b)=>a.outputPath.localeCompare(b.outputPath,'en'))
}
