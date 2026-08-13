#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path
from generate_role_policy import main as generate_roles

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
    end=text.find('\n---\n',4)
    if end<0: raise ValueError('unterminated frontmatter')
    fm=text[4:end].splitlines(); body=text[end+5:].strip()+'\n'
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


def main():
    generate_roles()
    raw=json.loads(ROLE_CATALOG.read_text(encoding='utf-8'))
    contracts={item['id']:item for item in raw['roles']}
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
        permission=fm.get('permission')
        if not isinstance(permission,dict): raise ValueError(f'{path}: permission projection required until M3')
        permission['skill']={name:'allow' for name in sorted(compatible_skills[path.stem])}
        permission['skill']['*']='deny'
        fm['description']=contract['purpose']
        fm['mode']='primary' if contract['role_class']=='primary' else 'subagent'
        role_contract='## Role Contract\n\nPurpose: '+contract['purpose']+'\n\nUse when:\n'+'\n'.join('- '+x for x in contract['use_when'])+'\n\nDo not use when:\n'+'\n'.join('- '+x for x in contract['do_not_use_when'])+'\n\n'
        fm['prompt']=role_contract+body
        agents[path.stem]=fm
    OUT.parent.mkdir(parents=True,exist_ok=True)
    payload=json.dumps(agents,ensure_ascii=False,sort_keys=True,separators=(',',':'))
    OUT.write_text('/* generated from data/hi-roles.json + roles/*.md by scripts/generate_plugin_agents.py; do not hand edit */\n'
                   f'export const PACKAGED_HI_AGENTS = {payload} as const\n',encoding='utf-8')
    print(f'generated {len(agents)} agents -> {OUT.relative_to(ROOT)}')

if __name__=='__main__': main()
