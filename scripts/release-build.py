#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, zipfile
from pathlib import Path

KIT=Path(__file__).resolve().parents[1]
DIST_DIRS=['skills','plugin/dist']
DIST_FILES=['VERSION','package.json','README.md','README.tr.md','LICENSE','THIRD_PARTY_NOTICES.md']
SOURCE_DIRS=['roles','skills','scripts','data','docs','plugin','tests']
SOURCE_FILES=['VERSION','package.json','README.md','README.tr.md','SECURITY.md','CONTRIBUTING.md','LICENSE','THIRD_PARTY_NOTICES.md','CHANGELOG.md','.gitignore','pytest.ini','requirements-dev.txt','.gitattributes']
# Personal/development-environment files never enter shareable archives.
FORBIDDEN_ROOTS={'.opencode','opencode.jsonc','AGENTS.md'}

def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for c in iter(lambda:f.read(65536),b''):h.update(c)
    return h.hexdigest()

def digest_entries(entries):
    h=hashlib.sha256()
    for n,p in sorted(entries.items()):
        h.update(n.encode('utf-8')); h.update(b'\0'); h.update(sha(p).encode('ascii')); h.update(b'\0')
    return h.hexdigest()

def collect(dirs, files):
    out={}
    # Transient package-manager / build / test artifacts must never enter the archive,
    # otherwise SOURCE archive SHA-256 drifts whenever an engineer ran `npm install`,
    # `pytest`, `npm run build`, etc. before release.
    excluded_dirs={'node_modules','.venv','venv','__pycache__','.pytest_cache','.opencode'}
    excluded_files={'bun.lock','bun.lockb','yarn.lock','pnpm-lock.yaml','.tsbuildinfo'}
    # Normalize archive arcnames to POSIX slashes; otherwise on Windows
    def _norm(p): return str(p).replace('\\','/')
    for d in dirs:
        base=KIT/d
        if not base.exists():
            continue
        for p in base.rglob('*'):
            rel=p.relative_to(KIT)
            if any(part in excluded_dirs for part in rel.parts): continue
            if p.name in excluded_files: continue
            if p.is_symlink(): raise SystemExit(f'release source symlink is not allowed: {rel}')
            if not p.is_file():
                continue
            if rel.parts and rel.parts[0] in FORBIDDEN_ROOTS:
                continue
            out[_norm(rel)]=p
    for n in files:
        if n in FORBIDDEN_ROOTS:
            continue
        p=KIT/n
        if p.is_symlink(): raise SystemExit(f'release source symlink is not allowed: {n}')
        if p.is_file(): out[_norm(n)]=p
    return out

CANONICAL_ZIP_TIME=(2026,1,1,0,0,0)

def write_zip(path, entries):
    path.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as f:
        for n,p in sorted(entries.items()):
            info=zipfile.ZipInfo(n,CANONICAL_ZIP_TIME)
            info.create_system=3
            mode=0o100755 if n.endswith('.sh') else 0o100644
            info.external_attr=(mode << 16)
            info.compress_type=zipfile.ZIP_DEFLATED
            # Do not inherit filesystem mtimes, uid/gid, platform attributes or
            # checkout-specific metadata. Identical file bytes must yield an
            # identical archive across machines/checkouts.
            f.writestr(info,p.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)


def dependency_components(root:Path):
    lock_path=root/'plugin'/'package-lock.json'
    if not lock_path.is_file(): return [], None
    lock=json.loads(lock_path.read_text())
    packages=lock.get('packages') or {}
    root_meta=packages.get('') or {}
    direct_dev=set((root_meta.get('devDependencies') or {}).keys())
    direct_peer=set((root_meta.get('peerDependencies') or {}).keys())
    out=[]
    for pkg_path,meta in packages.items():
        if not pkg_path: continue
        marker='node_modules/'
        name=meta.get('name') or (pkg_path.split(marker)[-1] if marker in pkg_path else pkg_path)
        relation='direct-peer' if name in direct_peer else ('direct-dev' if name in direct_dev else 'transitive')
        out.append({'path':pkg_path.replace('\\','/'),'name':name,'version':str(meta.get('version') or ''),'license':str(meta.get('license') or 'UNKNOWN'),'relation':relation})
    out.sort(key=lambda x:x['path'])
    h=hashlib.sha256()
    for c in out:
        for k in ('path','name','version','license','relation'):
            h.update(c[k].encode('utf-8')); h.update(b'\0')
        h.update(b'\n')
    return out,h.hexdigest()

def validate_third_party_notices(root:Path,components):
    path=root/'THIRD_PARTY_NOTICES.md'
    if not path.is_file(): return ['THIRD_PARTY_NOTICES.md missing']
    text=path.read_text()
    issues=[]
    for c in components:
        if c['relation'] not in ('direct-dev','direct-peer'): continue
        if f'`{c["name"]}`' not in text: issues.append(f'THIRD_PARTY_NOTICES missing {c["name"]}')
        if c['license']!='UNKNOWN' and c['license'] not in text: issues.append(f'THIRD_PARTY_NOTICES missing license {c["license"]} for {c["name"]}')
    return issues

def write_sbom(path:Path,version:str,components,graph_sha:str):
    direct=[c for c in components if c['relation']!='transitive']
    sbom={'schema':1,'format':'Hi-SBOM','product':'OpenCode-Hi','version':version,'dependency_lock':'plugin/package-lock.json','dependency_graph_sha256':graph_sha,'component_count':len(components),'direct_component_count':len(direct),'components':components}
    path.write_text(json.dumps(sbom,indent=2,sort_keys=True)+'\n')
    return sbom

def release_identity(root:Path, version:str):
    issues=[]
    try:
        pkg=json.loads((root/'package.json').read_text())
        if pkg.get('version')!=version: issues.append('root package version mismatch')
    except Exception: issues.append('root package unreadable')
    try:
        pp=json.loads((root/'plugin'/'package.json').read_text())
        if pp.get('version')!=version: issues.append('plugin package version mismatch')
        root_license=pkg.get('license') if isinstance(pkg,dict) else None
        if root_license and pp.get('license')!=root_license: issues.append('plugin package license mismatch')
    except Exception: issues.append('plugin package unreadable')
    try:
        changelog=(root/'CHANGELOG.md').read_text()
        import re
        if not re.search(rf'^##\s+(?:\[)?v?{re.escape(version)}(?:\])?(?:\s|$)',changelog,re.M|re.I): issues.append('CHANGELOG version entry missing')
    except Exception: issues.append('CHANGELOG unreadable')
    for lock in (root/'package-lock.json',root/'plugin'/'package-lock.json'):
        if not lock.is_file(): continue
        try:
            lj=json.loads(lock.read_text()); lv=((lj.get('packages') or {}).get('') or {}).get('version') or lj.get('version')
            if lv and lv!=version: issues.append(f'{lock.relative_to(root).as_posix()} version mismatch')
        except Exception: issues.append(f'{lock.relative_to(root).as_posix()} unreadable')
    return issues

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--out',type=Path,default=KIT/'dist')
    ap.add_argument('--source-out',type=Path,help='Output directory for the clean SOURCE archive; personal .opencode/opencode.jsonc/AGENTS.md files are excluded')
    a=ap.parse_args()
    version=(KIT/'VERSION').read_text().strip()
    identity_issues=release_identity(KIT,version)
    components,dependency_graph_sha256=dependency_components(KIT)
    identity_issues.extend(validate_third_party_notices(KIT,components))
    if identity_issues:
        raise SystemExit('release identity mismatch: '+', '.join(identity_issues))

    runtime=KIT/'plugin'/'dist'/'plugin.js'
    if not runtime.is_file():
        raise SystemExit('HI plugin runtime missing. Build first: cd plugin && npm run build')
    a.out.mkdir(parents=True,exist_ok=True)
    sbom_path=a.out/f'SBOM-{version}.json'
    sbom=write_sbom(sbom_path,version,components,dependency_graph_sha256)
    e=collect(DIST_DIRS,DIST_FILES)
    e[sbom_path.name]=sbom_path
    z=a.out/f'OpenCode-Hi-{version}-DISTRIBUTABLE.zip'
    write_zip(z,e)
    inputs_sha256=digest_entries(e)
    m={'schema':5,'product_name':'OpenCode-Hi','repository':'https://github.com/huseyincig/OpenCode-Hi','version':version,'release_identity':{'version_file':version,'root_package':json.loads((KIT/'package.json').read_text()).get('version'),'plugin_package':json.loads((KIT/'plugin'/'package.json').read_text()).get('version'),'plugin_package_lock':((json.loads((KIT/'plugin'/'package-lock.json').read_text()).get('packages') or {}).get('') or {}).get('version') if (KIT/'plugin'/'package-lock.json').is_file() else None,'changelog_entry':True},'archive':z.name,'archive_sha256':sha(z),'file_count':len(e),'plugin_runtime_sha256':sha(runtime),'provenance':{'schema':1,'builder':'scripts/release-build.py','deterministic_zip':True,'canonical_zip_time':'2026-01-01T00:00:00Z','inputs_sha256':inputs_sha256,'input_file_count':len(e)},'supply_chain':{'schema':1,'dependency_lock':'plugin/package-lock.json','dependency_graph_sha256':dependency_graph_sha256,'component_count':len(components),'sbom':sbom_path.name,'sbom_sha256':sha(sbom_path),'third_party_notices_sha256':sha(KIT/'THIRD_PARTY_NOTICES.md')},'files':{n:sha(p) for n,p in sorted(e.items())}}
    (a.out/f'RELEASE-MANIFEST-{version}.json').write_text(json.dumps(m,indent=2)+'\n')
    print(f'DISTRIBUTABLE: {z}\nFILE COUNT: {len(e)}\nSHA256: {m["archive_sha256"]}')

    if a.source_out:
        se=collect(SOURCE_DIRS,SOURCE_FILES)
        sz=a.source_out/f'OpenCode-Hi-{version}-SOURCE.zip'
        write_zip(sz,se)
        print(f'SOURCE: {sz}\nSOURCE FILE COUNT: {len(se)}\nSOURCE SHA256: {sha(sz)}')

if __name__=='__main__': main()
