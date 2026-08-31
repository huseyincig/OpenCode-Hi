import type {ProcessExecutor} from '../../runtime/process/executor.js'
import type {WorkspaceExecutor} from '../../runtime/workspace/executor.js'
function unavailable(name:string):never{throw new Error(`UNSUPPORTED_CAPABILITY: OpenCode V2 Promise context does not expose ${name}`)}
export class V2UnavailableProcessExecutor implements ProcessExecutor{
 async health(){return{available:false,detail:'V2 Promise context exposes shell policy hooks but no owned PTY lifecycle API'}}
 async spawn():Promise<any>{return unavailable('process lifecycle')};async write():Promise<void>{return unavailable('process lifecycle')};async read():Promise<any>{return unavailable('process lifecycle')};async observe():Promise<any>{return unavailable('process lifecycle')};async wait():Promise<any>{return unavailable('process lifecycle')};async kill():Promise<any>{return unavailable('process lifecycle')};async cleanup():Promise<any>{return unavailable('process lifecycle')};async reconcile(contract:any):Promise<any>{return{disposition:'ORPHANED',contract:{...contract,status:'ORPHANED',cleanup_state:'QUARANTINED',termination_reason:contract.termination_reason??'V2 Promise host does not expose owned process lifecycle for reconciliation'}}}
}
export class V2UnavailableWorkspaceExecutor implements WorkspaceExecutor{
 async health(){return{available:false,detail:'V2 Promise context exposes location binding but no workspace provision/remove API'}}
 async sourceBaseline():Promise<string>{return unavailable('workspace lifecycle')};async provision():Promise<any>{return unavailable('workspace lifecycle')};async reintegrate():Promise<any>{return unavailable('workspace lifecycle')};async reconcile(lease:any):Promise<any>{return{disposition:'ORPHANED',lease:{...lease,status:'ORPHANED',cleanup_state:'QUARANTINED'}}};async cleanup():Promise<void>{return unavailable('workspace lifecycle')}
}
