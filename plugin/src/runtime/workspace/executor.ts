import type { WorkspaceLeaseContract } from '../../contracts/workspace.js'

export interface WorkspaceProvisionRequest{
  mission_id:string
  task_id:string
  repository_root:string
  source_baseline:string
}
export interface WorkspaceProvisioned{host_workspace_id:string;workspace_path:string;branch?:string}
export interface WorkspaceReintegrateRequest{session_id:string;lease:WorkspaceLeaseContract;task_scope:string[];expected_changed_files:string[]}
export interface WorkspaceReintegrated{applied_files:string[]}
export type WorkspaceReconcileDisposition='ADOPTED'|'CLOSED'|'ORPHANED'
export interface WorkspaceReconcileResult{disposition:WorkspaceReconcileDisposition;lease:WorkspaceLeaseContract}

export interface WorkspaceExecutor{
  sourceBaseline(repositoryRoot:string):Promise<string>
  provision(request:WorkspaceProvisionRequest):Promise<WorkspaceProvisioned>
  reintegrate(request:WorkspaceReintegrateRequest):Promise<WorkspaceReintegrated>
  reconcile(lease:WorkspaceLeaseContract):Promise<WorkspaceReconcileResult>
  cleanup(lease:WorkspaceLeaseContract):Promise<void>
}
