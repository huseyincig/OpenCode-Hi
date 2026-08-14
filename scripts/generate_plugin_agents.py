#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path
from generate_role_policy import main as generate_roles
from generate_permission_policy import main as generate_permissions,load_catalog as load_permission_catalog,render_native_permission

ROOT=Path(__file__).resolve().parents[1]
ROLES=ROOT/'roles'
ROLE_CATALOG=ROOT/'data'/'hi-roles.json'
METHODOLOGY_CATALOG=ROOT/'data'/'hi-methodologies.json'
OUT=ROOT/'plugin'/'src'/'generated'/'agent-config.ts'


def scalar(value:str):
    v=value.strip()
    if v in ('true','false'): return v=='true'
    try: return int(v)
    except ValueError: pass
    if (len(v)>=2 and v[0]==v[-1] and v[0] in "\"'"):
        return v[1:-1]
    return v


def parse_frontmatter(text:str):
    if not text.startswith('---\n'): raise ValueError('missing frontmatter')
    end=text.find('---\n',4)
    if end<0: raise ValueError('unterminated frontmatter')
    fm=text[4:end].splitlines(); body=text[end+4:].lstrip('\n').strip()+'\n'
    root={}; stack=[(-1,root)]
    for raw in fm:
        if not raw.strip() or raw.lstrip().startswith('#'): continue
        indent=len(raw)-len(raw.lstrip(' '))
        line=raw.strip()
        if ':' not in line: raise ValueError(f'unsupported frontmatter line: {raw}')
        key,val=line.split(':',1); key=key.strip().strip('"\''); val=val.strip()
        while stack and indent<=stack[-1][0]: stack.pop()
        parent=stack[-1][1]
        if val=='':
            node={}; parent[key]=node; stack.append((indent,node))
        else: parent[key]=scalar(val)
    return root,body



def stable_control_policy(contract:dict,permission:dict)->str:
    if contract['role_class']=='primary':
        return (
            '## Hi Stable Control Policy\n\n'
            'Hi owns Mission decomposition, TaskRuntime dispatch, model routing, continuation, completion and STOP. '
            'Use only the Hi task/team control plane for delegation; methodologies provide engineering method and never own orchestration or authority.\n\n'
            'OpenCode session, permission, tool, provider and other host primitives remain host mechanisms behind Hi boundaries. '
            'Never perform unrequested external effects. Required independent review must come from a bounded reviewer worker; parent self-review is not independent evidence. '
            'Do not claim completion while obligations, blockers, authority gates or required fresh verification remain open.\n\n'
        )
    mutation='write-capable' if permission.get('edit')=='allow' else 'read-only'
    return (
        '## Hi Stable Worker Policy\n\n'
        f'This is a {mutation} bounded Hi worker projection. Execute the assigned Task; do not become the top-level orchestrator or spawn/coordinate additional agents. '
        'Hi owns TaskRuntime, model routing, continuation, authority and STOP.\n\n'
        'Load only methodologies selected by the current Hi runtime projection through the OpenCode native skill primitive. '
        'Preserve user-owned pre-existing changes, stay within assigned scope, return the structured WorkerResult, and never perform unrequested external effects.\n\n'
    )

def main():
    generate_permissions()
    generate_roles()
    raw=json.loads(ROLE_CATALOG.read_text(encoding='utf-8'))
    if raw.get('schema')!=2: raise ValueError('hi-roles catalog schema must be 2 for PermissionProfile binding')
    contracts={item['id']:item for item in raw['roles']}
    permission_profiles={item['id']:item for item in load_permission_catalog()}
    methodology=json.loads(METHODOLOGY_CATALOG.read_text(encoding='utf-8'))
    compatible_skills={role_id:[] for role_id in contracts}
    for item in methodology['profiles']:
        for role_id in item.get('compatible_roles',[]):
            if role_id not in compatible_skills: raise ValueError(f"{item['name']}: unknown compatible role {role_id}")
            compatible_skills[role_id].append(item['name'])
    agents={}
    for path in sorted(ROLES.glob('*.md')):
        fm,body=parse_frontmatter(path.read_text(encoding='utf-8'))
        contract=contracts[path.stem]
        if 'description' in fm or 'mode' in fm: raise ValueError(f'{path}: description/mode belong to RoleContract, not Markdown projection')
        if 'permission' in fm: raise ValueError(f'{path}: permission belongs to PermissionProfile/Methodology contracts, not Markdown guidance')
        profile_ref=contract.get('permission_profile_ref')
        if profile_ref not in permission_profiles: raise ValueError(f'{path}: unknown permission profile {profile_ref}')
        permission=render_native_permission(permission_profiles[profile_ref])
        if 'skill' in permission: raise ValueError(f'{path}: PermissionProfile cannot own methodology skill permissions')
        permission['skill']={name:'allow' for name in sorted(compatible_skills[path.stem])}
        permission['skill']['*']='deny'
        fm['permission']=permission
        fm['description']=contract['purpose']
        fm['mode']='primary' if contract['role_class']=='primary' else 'subagent'
        role_contract='## Role Contract\n\nPurpose: '+contract['purpose']+'\n\nUse when:\n'+'\n'.join('- '+x for x in contract['use_when'])+'\n\nDo not use when:\n'+'\n'.join('- '+x for x in contract['do_not_use_when'])+'\n\n'
        fm['prompt']=role_contract+stable_control_policy(contract,permission)+body
        agents[path.stem]=fm
    OUT.parent.mkdir(parents=True,exist_ok=True)
    payload=json.dumps(agents,ensure_ascii=False,sort_keys=True,separators=(',',':'))
    OUT.write_bytes(('/* generated from data/hi-roles.json + data/hi-permission-profiles.json + data/hi-methodologies.json + roles/*.md by scripts/generate_plugin_agents.py; do not hand edit */\n'
                   f'export const PACKAGED_HI_AGENTS = {payload} as const\n').encode('utf-8'))
    print(f'generated {len(agents)} agents -> {OUT.relative_to(ROOT)}')

if __name__=='__main__': main()
