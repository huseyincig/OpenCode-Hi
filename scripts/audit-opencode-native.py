#!/usr/bin/env python3
from __future__ import annotations
import argparse,hashlib,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
EXPECTED_VERSION='1.18.18'
DEFAULT_COMMIT='e23586af2623f1bc2e8e6965d2d7acf7bd03d5c3'
SOURCES={
 'plugin-hooks':'packages/plugin/src/index.ts',
 'session':'packages/opencode/src/session/session.ts',
 'task':'packages/opencode/src/tool/task.ts',
 'permission':'packages/opencode/src/permission/index.ts',
 'pty':'packages/opencode/src/server/routes/instance/httpapi/groups/pty.ts',
 'workspace':'packages/opencode/src/control-plane/workspace.ts',
 'workspace-adapter':'packages/opencode/src/control-plane/adapters/worktree.ts',
 'skill':'packages/opencode/src/skill/index.ts',
 'lsp':'packages/opencode/src/lsp/lsp.ts',
 'sdk':'packages/sdk/js/src/gen/sdk.gen.ts',
 'sdk-v2':'packages/sdk/js/src/v2/gen/sdk.gen.ts',
 'sdk-types':'packages/sdk/js/src/gen/types.gen.ts',
 'package':'packages/opencode/package.json',
}
def git(root:Path,*args:str,bytes=False):
    return subprocess.check_output(['git','-C',str(root),*args],stderr=subprocess.STDOUT,text=not bytes)
def blob(root:Path,commit:str,path:str)->bytes:return git(root,'show',f'{commit}:{path}',bytes=True)
def text(root:Path,commit:str,path:str)->str:return blob(root,commit,path).decode()
def require(haystack:str,*needles:str):
    for n in needles:
        if n not in haystack:raise RuntimeError(f'upstream evidence missing: {n}')
def main()->int:
    ap=argparse.ArgumentParser();ap.add_argument('--upstream',required=True);ap.add_argument('--commit',default=DEFAULT_COMMIT);ap.add_argument('--output',default='data/validation/opencode-native-reevaluation.json');a=ap.parse_args()
    upstream=Path(a.upstream).resolve();commit=git(upstream,'rev-parse',a.commit).strip();
    package=json.loads(text(upstream,commit,SOURCES['package']));
    if package.get('version')!=EXPECTED_VERSION:raise RuntimeError(f'expected OpenCode {EXPECTED_VERSION}, observed {package.get("version")}')
    plugin=text(upstream,commit,SOURCES['plugin-hooks']);session=text(upstream,commit,SOURCES['session']);task=text(upstream,commit,SOURCES['task']);perm=text(upstream,commit,SOURCES['permission']);pty=text(upstream,commit,SOURCES['pty']);workspace=text(upstream,commit,SOURCES['workspace']);worktree=text(upstream,commit,SOURCES['workspace-adapter']);skill=text(upstream,commit,SOURCES['skill']);lsp=text(upstream,commit,SOURCES['lsp']);sdk=text(upstream,commit,SOURCES['sdk']);sdkv2=text(upstream,commit,SOURCES['sdk-v2']);types=text(upstream,commit,SOURCES['sdk-types'])
    require(session,'Session.create','Session.children','Session.fork')
    require(task,'TaskTool','deriveSubagentSessionPermission','subagent_depth')
    require(perm,'Permission.ask','Permission.reply')
    require(pty,'identifier: "pty.create"')
    require(workspace,'Workspace.create');require(worktree,'WorktreeAdapter')
    require(skill,'Skill')
    require(lsp,'workspaceSymbol','documentSymbol')
    require(sdk,'/find/symbol','find = new Find','lsp = new Lsp')
    if 'question = new Question' in sdk:raise RuntimeError('legacy plugin client unexpectedly exposes question namespace; HumanDecision boundary must be re-evaluated')
    require(sdkv2,'export class Question','/question/{requestID}/reply','/question/{requestID}/reject')
    question_region=sdkv2[sdkv2.find('export class Question'):sdkv2.find('export class Permission')]
    if '/question/{requestID}/ask' in sdkv2 or 'public ask<' in question_region:raise RuntimeError('public v2 question ask unexpectedly appeared; HumanDecision support boundary must be re-evaluated')
    require(plugin,'"permission.ask"?','"tool.execute.before"?','"tool.execute.after"?','"experimental.session.compacting"?')
    decisions=[
      {'surface':'sessions','native':'session.create/prompt/abort/status/children/fork/summarize/revert/unrevert','hi_decision':'KEEP_THIN_ADAPTER','reason':'Hi owns Mission/Task/Worker/evidence/recovery semantics, not native session mechanics.','hi_paths':['plugin/src/opencode/native-adapter.ts','plugin/src/opencode/client-adapter.ts','plugin/src/runtime/task/child-execution-coordinator.ts']},
      {'surface':'task-delegation','native':'TaskTool + child session + background jobs + permission inheritance','hi_decision':'KEEP_STRONGER_SEMANTIC_CONTROL','reason':'Native TaskTool does not own Hi obligation/evidence/completion, exact selected-model proof, WorkspaceLease ownership, or deterministic Mission recovery.','hi_paths':['plugin/src/runtime/task/task-runtime.ts','plugin/src/runtime/task/child-execution-coordinator.ts']},
      {'surface':'permission','native':'permission.ask hook + Permission.ask/reply','hi_decision':'KEEP_THIN_AUTHORITY_BINDING','reason':'Native permission remains execution authority substrate; Hi adds exact ExternalAction contracts, one-shot/replay semantics, and never widens denial.','hi_paths':['plugin/src/runtime/safety/authority.ts','plugin/src/runtime/safety/project-authority.ts','plugin/src/opencode/event-adapter.ts']},
      {'surface':'tool-events','native':'tool.execute.before/after + event hook','hi_decision':'KEEP_THIN_EVENT_ADAPTER','reason':'Hi uses native hooks as observations and maintains evidence/freshness/ownership semantics separately.','hi_paths':['plugin/src/opencode/open-code-hooks.ts','plugin/src/opencode/event-adapter.ts']},
      {'surface':'lsp','native':'find.symbols -> /find/symbol backed by LSP.workspaceSymbol; internal documentSymbol also exists','hi_decision':'KEEP_LOCAL_SEMANTIC_ADAPTER; NATIVE_DISCOVERY_OPTIONAL','reason':'Public symbol response is name/kind/location only and workspaceSymbol is bounded; it does not by itself satisfy source hash, signature/text, relationship, consumer-bound budget, and freshness requirements of SemanticContextContract.','hi_paths':['plugin/src/runtime/semantic/adapter.ts','plugin/src/runtime/semantic/typescript-context.ts']},
      {'surface':'pty','native':'v2 PTY create/get/remove/connect-token + events','hi_decision':'KEEP_THIN_PROCESS_ADAPTER','reason':'OpenCode owns PTY mechanics; Hi adds ProcessContract ownership, command identity, bounded output evidence, authority binding, restart adoption/quarantine, STOP cleanup.','hi_paths':['plugin/src/opencode/open-code-pty-adapter.ts','plugin/src/runtime/process/runtime.ts']},
      {'surface':'workspace','native':'experimental workspace create/list/remove + builtin worktree adapter + workspace-bound sessions','hi_decision':'KEEP_THIN_WORKSPACE_ADAPTER','reason':'OpenCode owns workspace bytes/lifecycle primitive; Hi adds IsolationDecision/WorkspaceLease source identity, exact child binding, cleanup/restart/orphan semantics.','hi_paths':['plugin/src/opencode/open-code-workspace-adapter.ts','plugin/src/runtime/workspace/runtime.ts']},
      {'surface':'provider-model-observation','native':'provider inventory + assistant message provider/model metadata','hi_decision':'KEEP_NORMALIZATION_ONLY','reason':'Hi routing policy consumes native inventory and verifies effective selected model; it does not own provider execution.','hi_paths':['plugin/src/opencode/host-port.ts','plugin/src/opencode/client-adapter.ts','plugin/src/runtime/routing/model-resolver.ts']},
      {'surface':'skill-loading','native':'OpenCode Skill service/discovery + native skill tool','hi_decision':'KEEP_POLICY_INDEX_ONLY','reason':'OpenCode owns skill discovery/loading; Hi owns methodology admission/selection and bounded catalog cache, not a second loader.','hi_paths':['plugin/src/runtime/skills/catalog-index.ts','plugin/src/runtime/methodology/native-loading.ts']},
      {'surface':'lifecycle-events','native':'plugin dispose/event + session/file/permission/tool/compaction events','hi_decision':'KEEP_THIN_EVENT_CONTROLLER','reason':'Hi maps native events into Mission ownership/freshness/recovery and persists only Hi semantic state.','hi_paths':['plugin/src/opencode/open-code-hooks.ts','plugin/src/runtime/application/runtime-event-controller.ts']},
      {'surface':'human-decision-structured-open','native':'question.list/reply/reject public SDK; host-internal Question.ask exists','hi_decision':'UNSUPPORTED_STRUCTURED_OPEN_KEEP_CHAT_TRANSPORT','reason':'Plugin/public SDK cannot deterministically open a question bound to an exact Hi decision_id; model-facing question tool is not a deterministic transport seam.','hi_paths':['plugin/src/runtime/human-decision/transport.ts']},
      {'surface':'compaction','native':'experimental.session.compacting hook','hi_decision':'KEEP_THIN_EXPERIMENTAL_BOUNDARY','reason':'Hi Context Governor supplies protected/compressible semantic context while OpenCode owns compaction primitive.','hi_paths':['plugin/src/opencode/experimental-adapter.ts','plugin/src/hooks/session-compacting.ts']},
    ]
    missing=[]
    for d in decisions:
        for rel in d['hi_paths']:
            if not (ROOT/rel).is_file():missing.append({'surface':d['surface'],'path':rel})
    out={
      'schema':1,'kind':'EXACT_CURRENT_OPENCODE_NATIVE_REEVALUATION','program':'PROMPT_B','status':'PASS' if not missing else 'FAIL',
      'opencode':{'version':EXPECTED_VERSION,'source_commit':commit,'source_worktree_used':False,'source_read_mode':'git-blob'},
      'upstream_blob_sha256':{k:{'path':v,'sha256':hashlib.sha256(blob(upstream,commit,v)).hexdigest()} for k,v in SOURCES.items()},
      'decisions':decisions,'missing_hi_paths':missing,
      'summary':{'surfaces':len(decisions),'remove_custom_mechanism':sum(d['hi_decision'].startswith('REMOVE') for d in decisions),'keep_thin_or_stronger':sum(d['hi_decision'].startswith('KEEP') for d in decisions),'unsupported':sum(d['hi_decision'].startswith('UNSUPPORTED') for d in decisions)},
      'claim_boundary':'Exact source re-evaluation for OpenCode 1.18.18 at the recorded commit. Native availability does not transfer Hi semantic ownership.'}
    path=ROOT/a.output;path.write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n');print(f"native reevaluation {out['status']}: surfaces={len(decisions)} missing={len(missing)} commit={commit}");return 0 if not missing else 1
if __name__=='__main__':sys.exit(main())
