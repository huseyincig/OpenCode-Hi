import {AuthoritativeRunLock,reconcileContinuation} from './authoritative-run.mjs'
import {FixtureManager} from './fixture-manager.mjs'
import {ImmutableReceiptWriter,createRunId,admitRerunLineage} from './receipts.mjs'
import {assertWorkloadSpec} from './workload-spec.mjs'
export class WorkloadAcceptanceHarness{
  constructor({stateRoot,productIdentity,liveInventory,sessionProbe,processProbe,runMetaProbe,runtimeStateProbe,receiptProbe}){this.stateRoot=stateRoot;this.productIdentity=productIdentity;this.liveInventory=liveInventory;this.sessionProbe=sessionProbe;this.processProbe=processProbe;this.runMetaProbe=runMetaProbe;this.runtimeStateProbe=runtimeStateProbe;this.receiptProbe=receiptProbe}
  async preflight(spec,{predecessor,conditionFingerprint,repairReceipt,materialChangeReceipt,prepareFixture}={}){
    assertWorkloadSpec(spec)
    const lockPath=`${this.stateRoot}/${spec.id}/authoritative.lock`
    const reconciled=await reconcileContinuation({lockPath,workloadId:spec.id,processProbe:this.processProbe,sessionProbe:this.sessionProbe,runMetaProbe:this.runMetaProbe,runtimeStateProbe:this.runtimeStateProbe,receiptProbe:this.receiptProbe})
    if(reconciled.disposition==='ADOPT_WAIT'||reconciled.disposition==='AMBIGUOUS_BLOCKED')return{disposition:reconciled.disposition,reconciled}
    const lineage=admitRerunLineage({predecessorRunId:predecessor?.run_id,predecessorCondition:predecessor?.condition_fingerprint,currentCondition:conditionFingerprint,repairReceipt,materialChangeReceipt})
    const runId=createRunId(spec.id),lock=new AuthoritativeRunLock(lockPath,{workloadId:spec.id,runId,predecessorRunId:predecessor?.run_id})
    await lock.acquire()
    const receipts=new ImmutableReceiptWriter(`${this.stateRoot}/${spec.id}/runs/${runId}/receipts`,runId)
    receipts.write('run-identity',{workload_id:spec.id,predecessor_run_id:predecessor?.run_id??null,condition_fingerprint:conditionFingerprint})
    receipts.write('product-identity',this.productIdentity)
    receipts.write('lineage',{workload_id:spec.id,predecessor_run_id:predecessor?.run_id??null,condition_fingerprint:conditionFingerprint,predecessor_condition_fingerprint:predecessor?.condition_fingerprint??null,reason:lineage.reason,repair_receipt:repairReceipt??null,material_change_receipt:materialChangeReceipt??null})
    if(prepareFixture){const manager=new FixtureManager({...spec.fixture,workloadId:spec.id,fixtureRoot:spec.fixture.root,reset:prepareFixture});const fixture=await manager.reset(lock);receipts.write('fixture-identity',fixture)}
    return{disposition:'READY_TO_EXECUTE',run_id:runId,lock,receipts}
  }
}
