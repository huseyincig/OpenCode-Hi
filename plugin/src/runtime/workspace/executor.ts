import type { WorkspaceLeaseContract } from '../../contracts/workspace.js'

export interface WorkspaceProvisionRequest{
  mission_id:string
  task_id:string
  repository_root:string
  source_baseline:string
}
export interface WorkspaceProvisioned{host_workspace_id:string;workspace_path:string;branch?:string}
export type WorkspaceReconcileDisposition='ADOPTED'|'CLOSED'|'ORPHANED'
export interface WorkspaceReconcileResult{disposition:WorkspaceReconcileDisposition;lease:WorkspaceLeaseContract}

export interface WorkspaceExecutor{
  sourceBaseline(repositoryRoot:string):Promise<string>
  provision(request:WorkspaceProvisionRequest):Promise<WorkspaceProvisioned>
  reconcile(lease:WorkspaceLeaseContract):Promise<WorkspaceReconcileResult>
  cleanup(lease:WorkspaceLeaseContract):Promise<void>
}
