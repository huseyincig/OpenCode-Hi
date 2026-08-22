import { createHash } from 'node:crypto'
import { closeSync,fstatSync,lstatSync,openSync,readSync,realpathSync } from 'node:fs'
import { dirname,relative,resolve,sep } from 'node:path'
import { normalizeBoundedProjectPath } from '../../contracts/common.js'

const CHUNK_BYTES=256*1024
const MAX_SCOPE_FILES=100

function inside(root:string,candidate:string):boolean{const rel=relative(root,candidate);return rel===''||(rel!=='..'&&!rel.startsWith(`..${sep}`)&&!rel.startsWith('../')&&!rel.startsWith('..\\'))}

function stableFileHash(root:string,path:string):string|undefined{
  const rel=normalizeBoundedProjectPath(path);if(!rel)return undefined
  const absolute=resolve(root,rel)
  let canonicalRoot:string,canonicalParent:string
  try{canonicalRoot=realpathSync(root);canonicalParent=realpathSync(dirname(absolute))}catch{return undefined}
  if(!inside(canonicalRoot,canonicalParent))return undefined
  let pre:any
  try{pre=lstatSync(absolute,{bigint:true})}catch{return undefined}
  if(pre.isSymbolicLink?.()||!pre.isFile?.())return undefined
  let fd:number|undefined
  try{
    fd=openSync(absolute,'r')
    const opened=fstatSync(fd,{bigint:true});if(!opened.isFile?.())return undefined
    const h=createHash('sha256'),buffer=Buffer.allocUnsafe(CHUNK_BYTES)
    let position=0
    for(;;){const n=readSync(fd,buffer,0,CHUNK_BYTES,position);if(n<=0)break;h.update(n===CHUNK_BYTES?buffer:buffer.subarray(0,n));position+=n}
    const post=fstatSync(fd,{bigint:true})
    const identityKnown=(opened.dev!==0n||opened.ino!==0n)&&(post.dev!==0n||post.ino!==0n)
    if((identityKnown&&(opened.dev!==post.dev||opened.ino!==post.ino))||opened.size!==post.size||opened.mtimeNs!==post.mtimeNs||opened.ctimeNs!==post.ctimeNs)return undefined
    return h.digest('hex')
  }catch{return undefined}finally{if(fd!==undefined)try{closeSync(fd)}catch{}}
}

/**
 * Bind canonical evidence to the exact current bytes of its bounded file scope.
 * Scope-state is an evidence freshness primitive, not a second filesystem owner.
 */
export function captureEvidenceScopeState(projectRoot:string,scope:string[]):string|undefined{
  const files=[...new Set(scope.map(path=>normalizeBoundedProjectPath(path)).filter((path):path is string=>Boolean(path)))].sort()
  if(!files.length||files.length>MAX_SCOPE_FILES)return undefined
  const aggregate=createHash('sha256')
  for(const file of files){const hash=stableFileHash(projectRoot,file);if(!hash)return undefined;aggregate.update(file);aggregate.update('\0');aggregate.update(hash);aggregate.update('\0')}
  return aggregate.digest('hex')
}

export function evidenceScopeStateIsCurrent(projectRoot:string,scope:string[],expected:string|undefined):boolean{
  if(!expected||!/^[a-f0-9]{64}$/i.test(expected))return false
  const current=captureEvidenceScopeState(projectRoot,scope)
  return current!==undefined&&current===expected
}
