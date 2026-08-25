import {mkdirSync,statSync,realpathSync} from 'node:fs'
import {resolve,sep} from 'node:path'
function inside(child,parent){const c=resolve(child),p=resolve(parent);return c===p||c.startsWith(p+sep)}
export function prepareOperatorControlRoot(path,fixtureRoot){mkdirSync(path,{recursive:true,mode:0o700});const real=realpathSync(path),mode=statSync(real).mode&0o777;if(inside(real,fixtureRoot)||mode&0o077)throw new Error('CONTROL_ROOT_ISOLATION_VIOLATION');return{path:real,mode}}
