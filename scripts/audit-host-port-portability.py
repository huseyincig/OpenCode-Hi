#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-host-port-portability.json'
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
checks=[
 ('host-port-hi-needs-not-sdk','plugin/src/runtime/host/port.ts','export interface HostPort','plugin/test/a6-host-port-typing.test.mjs','generic HostPort expresses Hi host needs without importing OpenCode SDK types'),
 ('semantic-core-sdk-confinement','plugin/src/runtime/application/runtime-event-controller.ts',"import type { HostEvent,HostPort } from '../host/port.js'",'plugin/test/a6-host-port-typing.test.mjs','semantic runtime core has no raw OpenCode SDK/client lifecycle dependency'),
 ('normalized-event-boundary','plugin/src/opencode/open-code-hooks.ts','eventController.handle(normalizeOpenCodeEvent(input?.event??input))','plugin/test/a6-host-port-typing.test.mjs','raw host event normalization occurs at OpenCode hook boundary'),
 ('continuation-port','plugin/src/runtime/continuation/dispatcher.ts',"Pick<HostPort,'continueSession'|'sessionStatus'>",'plugin/test/a6-host-port-typing.test.mjs','alternate host continuation port preserves Mission continuation semantics without OpenCode shapes'),
 ('child-session-port','plugin/src/runtime/task/child-execution-coordinator.ts','constructor(private readonly host:ChildSessionPort','plugin/test/a6-host-port-typing.test.mjs','alternate host child-session port can execute a Hi task without OpenCode client structure'),
 ('runtime-service-injection','plugin/src/runtime/application/runtime-services.ts','export interface RuntimeServicePorts','plugin/test/a6-host-port-typing.test.mjs','runtime composition accepts injected host-semantic executors instead of constructing OpenCode adapters'),
 ('process-error-semantic-owner','plugin/src/runtime/process/executor.ts','export class ProcessSpawnPermissionError','plugin/test/p2-opencode-pty-executor.test.mjs','P2 spawn never silently executes native permission ask/deny'),
 ('provider-policy-host-generic','plugin/src/runtime/host/provider-policy.ts','export function providerPolicyView','plugin/test/native-first.test.mjs','Native-10 provider policy deny removes an otherwise available model'),
 ('missing-capability-fail-closed','plugin/src/runtime/task/task-runtime.ts',"hostCapabilitySource:(()=>readonly HostCapabilityContract[])|readonly HostCapabilityContract[]=[]".replace('= []','= []'),'plugin/test/methodology-host-capability.test.mjs','browser and visual methodologies require canonical runtime browser-execution resource'),
 ('alternate-host-continuation-feasible','plugin/src/runtime/host/port.ts','continueSession(sessionID:string,text:string,metadata:Record<string,unknown>):Promise<boolean>','plugin/test/a6-host-port-typing.test.mjs','alternate host continuation port preserves Mission continuation semantics without OpenCode shapes'),
 ('alternate-host-task-feasible','plugin/src/runtime/host/port.ts','export interface ChildSessionPort','plugin/test/a6-host-port-typing.test.mjs','alternate host child-session port can execute a Hi task without OpenCode client structure'),
]
violations=[];rows=[]
for name,owner,oa,proof,pa in checks:
    op,pp=ROOT/owner,ROOT/proof
    if not op.is_file():violations.append(f'{name}:missing-owner:{owner}');continue
    if not pp.is_file():violations.append(f'{name}:missing-proof:{proof}');continue
    ot,pt=op.read_text(errors='replace'),pp.read_text(errors='replace')
    if oa not in ot:violations.append(f'{name}:owner-anchor-drift:{oa}')
    if pa not in pt:violations.append(f'{name}:proof-anchor-drift:{pa}')
    rows.append({'invariant':name,'owner':owner,'owner_sha256':sha(owner),'owner_anchor':oa,'proof':proof,'proof_sha256':sha(proof),'proof_anchor':pa})
# Semantic core modules whose contracts must remain host-brand agnostic.
semantic_core=[
 'plugin/src/runtime/host/port.ts','plugin/src/runtime/host/provider-policy.ts','plugin/src/runtime/application/runtime-event-controller.ts',
 'plugin/src/runtime/application/runtime-services.ts','plugin/src/runtime/continuation/dispatcher.ts','plugin/src/runtime/task/task-runtime.ts',
 'plugin/src/runtime/task/child-execution-coordinator.ts','plugin/src/runtime/process/runtime.ts','plugin/src/runtime/process/executor.ts',
 'plugin/src/runtime/routing/model-resolver.ts'
]
for rel in semantic_core:
    text=(ROOT/rel).read_text(errors='replace')
    if re.search(r"from ['\"](?:\.\./)+opencode/|OpenCodeClient|OpenCodePluginContext|NativeOpenCodeAdapter|detectOpenCodeCapabilities",text):
        violations.append(f'static-guard:semantic-core-host-leak:{rel}')
port=(ROOT/'plugin/src/runtime/host/port.ts').read_text(errors='replace')
services=(ROOT/'plugin/src/runtime/application/runtime-services.ts').read_text(errors='replace')
plugin=(ROOT/'plugin/src/plugin.ts').read_text(errors='replace')
task=(ROOT/'plugin/src/runtime/task/task-runtime.ts').read_text(errors='replace')
guards={
 'generic_port_has_no_opencode_brand':'OpenCode' not in port and '@opencode-ai' not in port,
 'runtime_services_construct_no_opencode_adapters':not any(x in services for x in ['OpenCodePtyAdapter','OpenCodeWorkspaceAdapter','PlaywrightBrowserAdapter','OpenCodePluginContext']),
 'opencode_adapters_constructed_at_plugin_boundary':all(x in plugin for x in ['new OpenCodePtyAdapter','new OpenCodeWorkspaceAdapter','new PlaywrightBrowserAdapter','createOpenCodeChildSessionPort']),
 'capability_absence_defaults_empty':"hostCapabilitySource:(()=>readonly HostCapabilityContract[])|readonly HostCapabilityContract[]=[]" in task,
 'event_controller_has_no_raw_event_adapter':'event-adapter' not in (ROOT/'plugin/src/runtime/application/runtime-event-controller.ts').read_text(errors='replace'),
 'continuation_has_no_raw_client_adapter':'client-adapter' not in (ROOT/'plugin/src/runtime/continuation/dispatcher.ts').read_text(errors='replace'),
 'child_coordinator_has_no_raw_client_adapter':'client-adapter' not in (ROOT/'plugin/src/runtime/task/child-execution-coordinator.ts').read_text(errors='replace'),
}
for k,v in guards.items():
    if not v:violations.append('static-guard:'+k)
status='PASS' if not violations and len(rows)==len(checks) else 'FAIL'
data={
 'schema':1,'kind':'PROMPT_B_HOST_PORT_PORTABILITY_ADVERSARIAL_AUDIT','program':'PROMPT_B','section':22,'status':status,
 'invariants':rows,'static_guards':guards,'violations':violations,
 'summary':{'required':len(checks),'covered':len(checks)-len([v for v in violations if not v.startswith('static-guard:')]),'violations':len(violations)},
 'closed_defects':[
   {'id':'host-port-renamed-sdk-interface','fix':'HostPort now exposes Hi-semantic operations/capabilities rather than raw OpenCodeClient or NativeOpenCodeAdapter.'},
   {'id':'runtime-event-controller-opencode-lifecycle-leak','fix':'Raw OpenCode event/message shapes are normalized/read at the OpenCode adapter boundary; RuntimeEventController consumes HostEvent and HostPort.'},
   {'id':'task-runtime-opencode-client-leak','fix':'TaskRuntime and ChildExecutionCoordinator consume ChildSessionPort plus host capability contracts; OpenCode child lifecycle is implemented by createOpenCodeChildSessionPort.'},
   {'id':'runtime-service-opencode-construction-leak','fix':'Runtime services accept injected process/workspace/browser/child ports; OpenCode adapter construction lives in plugin.ts composition boundary.'},
   {'id':'process-error-opencode-owner-leak','fix':'ProcessSpawnPermissionError is owned by the generic ProcessExecutor contract, not the OpenCode PTY adapter.'},
   {'id':'routing-provider-policy-opencode-owner-leak','fix':'Provider policy parsing moved to runtime/host/provider-policy and model decisions use host-generic reason codes.'},
 ],
 'alternate_host_feasibility':{
   'status':'FEASIBLE_BY_PORT_CONTRACT_NOT_IMPLEMENTED',
   'assessed_host_example':'Claude Code or another session-capable coding host',
   'required_adapter_work':['HostPort','ChildSessionPort','ProcessExecutor','WorkspaceExecutor','BrowserExecutor','raw-event to HostEvent projection','host config/permission projection'],
   'semantic_core_changes_required':False,
   'constraint':'No alternate host implementation is claimed or shipped by this receipt.'
 },
 'claim_boundary':'OpenCode remains the only implemented host adapter. Section 22 certifies that Mission/Task/Authority/Evidence and the main continuation/task/process routing core no longer require OpenCode SDK types or lifecycle shapes; it does not certify another host implementation.'
}
OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(data,indent=2)+'\n')
print(f"host port portability audit {status}: covered={data['summary']['covered']}/{len(checks)} violations={len(violations)}")
if violations:print('\n'.join(violations))
sys.exit(0 if status=='PASS' else 1)
