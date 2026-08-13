#!/usr/bin/env python3
from __future__ import annotations
import json,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/'data'/'hi-methodologies.json'
SKILLS=ROOT/'skills'


def fail(msg:str): raise ValueError(msg)

def authored_parts(path:Path):
    text=path.read_text(encoding='utf-8')
    title=re.search(r'^#\s+(.+)$',text,re.M)
    method=re.search(r'^## Method\s*\n\n([\s\S]*?)\n\n## Ownership boundary',text,re.M)
    if not title: fail(f'{path}: missing title')
    if not method: fail(f'{path}: missing Method section')
    body=method.group(1).strip()
    if len(body)<180: fail(f'{path}: Method section is too thin to be operational')
    return title.group(1).strip(),body

def render(profile:dict,title:str,method:str)->str:
    affinity=', '.join(profile['role_affinity'])
    rows=[
      '---',
      f"name: {profile['name']}",
      f"description: {profile['purpose']}",
      '---','',f'# {title}','','## Contract','',
      f"- **Trigger:** {profile['trigger']}",
      f"- **Do not trigger:** {profile['do_not_trigger']}",
      f"- **Exit condition:** {profile['exit_condition']}",
      f'- **Role affinity:** {affinity}',
      f"- **Context cost:** {profile['context_cost']}",
      f"- **Execution cost:** {profile['execution_cost']}",
      '','## Method','',method,'','## Ownership boundary','',
      'This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.',''
    ]
    return '\n'.join(rows)

def main():
    raw=json.loads(CATALOG.read_text(encoding='utf-8'))
    profiles=raw.get('profiles',[])
    expected={p['name'] for p in profiles}
    actual={p.parent.name for p in SKILLS.glob('hi-*/SKILL.md')}
    if expected!=actual: fail(f'methodology catalog/package inventory drift: catalog={sorted(expected)} packaged={sorted(actual)}')
    methods={}
    for profile in profiles:
        path=SKILLS/profile['name']/'SKILL.md'
        title,method=authored_parts(path)
        key=re.sub(r'\s+',' ',method).strip().lower()
        if key in methods: fail(f'duplicate Method body: {methods[key]} and {profile["name"]}')
        methods[key]=profile['name']
        path.write_text(render(profile,title,method),encoding='utf-8')
    print(f'generated {len(profiles)} methodology skill projections')

if __name__=='__main__': main()
