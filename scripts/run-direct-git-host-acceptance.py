#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,os,platform,re,shutil,socket,subprocess,sys,tarfile,time,urllib.parse,urllib.request,zipfile
from pathlib import Path,PurePosixPath

ROOT=Path(__file__).resolve().parents[1]
PKG=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))
HOST_VERSION=str((PKG.get('dependencies') or {}).get('@opencode-ai/sdk') or '').strip()
if not re.fullmatch(r'\d+\.\d+\.\d+',HOST_VERSION) or (PKG.get('peerDependencies') or {}).get('@opencode-ai/plugin')!=HOST_VERSION:raise RuntimeError(f'exact current host target drift: {HOST_VERSION or "<missing>"}')
ASSET_MANIFEST=json.loads((ROOT/'data/opencode-host-assets.json').read_text(encoding='utf-8'))
if ASSET_MANIFEST.get('schema')!=1 or ASSET_MANIFEST.get('kind')!='OPENCODE_EXACT_HOST_ASSET_MANIFEST' or ASSET_MANIFEST.get('version')!=HOST_VERSION or ASSET_MANIFEST.get('tag')!=f'v{HOST_VERSION}' or ASSET_MANIFEST.get('release_immutable') is not True:raise RuntimeError('exact OpenCode host asset manifest drift')
PLATFORM_ASSET_KEYS={
 ('linux','x86_64'):'linux-x64',
 ('linux','amd64'):'linux-x64',
 ('linux','aarch64'):'linux-arm64',
 ('linux','arm64'):'linux-arm64',
 ('win32','amd64'):'windows-x64',
 ('win32','x86_64'):'windows-x64',
 ('win32','arm64'):'windows-arm64',
}

def sha256(path:Path)->str:
 h=hashlib.sha256()
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()

def _safe_archive_target(root:Path,name:str)->Path:
 parts=PurePosixPath(name).parts
 if not parts or PurePosixPath(name).is_absolute() or '..' in parts:raise RuntimeError(f'unsafe archive member path: {name}')
 target=(root/Path(*parts)).resolve();base=root.resolve()
 if target!=base and base not in target.parents:raise RuntimeError(f'archive member escapes destination: {name}')
 return target

def safe_extract_tar(archive:Path,destination:Path)->None:
 with tarfile.open(archive,'r:gz') as t:
  members=t.getmembers()
  for member in members:
   _safe_archive_target(destination,member.name)
   if not (member.isfile() or member.isdir()):raise RuntimeError(f'unsupported tar member type: {member.name}')
  for member in members:t.extract(member,destination)

def safe_extract_zip(archive:Path,destination:Path)->None:
 with zipfile.ZipFile(archive) as z:
  infos=z.infolist()
  for info in infos:
   _safe_archive_target(destination,info.filename)
   mode=(info.external_attr>>16)&0o170000
   if mode==0o120000:raise RuntimeError(f'zip symlink is not accepted: {info.filename}')
  for info in infos:z.extract(info,destination)

def exact_binary()->Path:
 supplied=os.environ.get('HI_EXACT_OPENCODE_BIN')
 if supplied:
  p=Path(supplied).expanduser().resolve()
  if not p.is_file():raise RuntimeError(f'HI_EXACT_OPENCODE_BIN missing: {p}')
  return p
 key=(sys.platform,platform.machine().lower())
 if key not in PLATFORM_ASSET_KEYS:raise RuntimeError(f'unsupported exact-host platform: {key}')
 asset_key=PLATFORM_ASSET_KEYS[key];meta=(ASSET_MANIFEST.get('assets') or {}).get(asset_key) or {}
 asset=str(meta.get('name') or '');digest=str(meta.get('sha256') or '');url=str(meta.get('url') or '')
 exe='opencode.exe' if sys.platform=='win32' else 'opencode'
 expected_prefix=f'https://github.com/anomalyco/opencode/releases/download/v{HOST_VERSION}/'
 if not asset or not re.fullmatch(r'[a-f0-9]{64}',digest) or not url.startswith(expected_prefix) or not url.endswith('/'+asset):raise RuntimeError(f'invalid exact OpenCode asset manifest entry: {asset_key}')
 tools=ROOT/'.agent-work/tools'/f'opencode-{HOST_VERSION}'
 tools.mkdir(parents=True,exist_ok=True)
 archive=tools/asset;binary=tools/exe
 if not archive.is_file() or sha256(archive)!=digest:
  if archive.exists():archive.unlink()
  req=urllib.request.Request(url,headers={'User-Agent':'OpenCode-Hi direct-Git acceptance'})
  with urllib.request.urlopen(req,timeout=180) as src, archive.open('wb') as dst:shutil.copyfileobj(src,dst)
 if sha256(archive)!=digest:raise RuntimeError(f'exact OpenCode archive digest mismatch: {asset}')
 if not binary.is_file():
  if asset.endswith('.zip'):safe_extract_zip(archive,tools)
  else:safe_extract_tar(archive,tools)
  if sys.platform!='win32':binary.chmod(0o755)
 return binary

def free_port()->int:
 s=socket.socket();s.bind(('127.0.0.1',0));p=s.getsockname()[1];s.close();return p

def get_json(url:str,timeout:float=3):
 with urllib.request.urlopen(url,timeout=timeout) as r:return json.loads(r.read().decode())

def main()->int:
 repository=os.environ.get('GITHUB_REPOSITORY');sha=os.environ.get('GITHUB_SHA')
 spec=os.environ.get('OPENCODE_HI_GIT_SPEC') or (f'opencode-hi@git+https://github.com/{repository}.git#{sha}' if repository and sha else None)
 if not spec:raise RuntimeError('direct-Git host acceptance requires OPENCODE_HI_GIT_SPEC or GITHUB_REPOSITORY + GITHUB_SHA')
 binary=exact_binary();version=subprocess.check_output([str(binary),'--version'],text=True).strip()
 if version!=HOST_VERSION:raise RuntimeError(f'exact OpenCode version mismatch: {version}')
 work=ROOT/'.agent-work/tmp/direct-git-host-acceptance';shutil.rmtree(work,ignore_errors=True)
 project=work/'project';home=work/'home';xdg=work/'xdg';project.mkdir(parents=True);home.mkdir();xdg.mkdir()
 (project/'opencode.json').write_text(json.dumps({'plugin':[spec]},indent=2)+'\n',encoding='utf-8')
 env=os.environ.copy();env.update({
  'HOME':str(home),'USERPROFILE':str(home),
  'XDG_DATA_HOME':str(xdg/'data'),'XDG_CONFIG_HOME':str(xdg/'config'),'XDG_CACHE_HOME':str(xdg/'cache'),'XDG_STATE_HOME':str(xdg/'state'),
  'APPDATA':str(xdg/'appdata'),'LOCALAPPDATA':str(xdg/'localappdata'),
 })
 for p in [xdg/'data',xdg/'config',xdg/'cache',xdg/'state',xdg/'appdata',xdg/'localappdata']:p.mkdir(parents=True,exist_ok=True)
 port=free_port();log=work/'opencode.log'
 with log.open('w',encoding='utf-8',errors='replace') as lf:
  proc=subprocess.Popen([str(binary),'serve','--hostname','127.0.0.1','--port',str(port),'--print-logs','--log-level','INFO'],cwd=project,env=env,stdout=lf,stderr=subprocess.STDOUT,text=True)
 ids=None;last_error=None
 try:
  for _ in range(240):
   if proc.poll() is not None:break
   try:
    q=urllib.parse.urlencode({'directory':str(project)});ids=get_json(f'http://127.0.0.1:{port}/experimental/tool/ids?{q}',2);break
   except Exception as e:last_error=str(e);time.sleep(.25)
 finally:
  try:proc.terminate();proc.wait(timeout=5)
  except Exception:
   try:proc.kill()
   except Exception:pass
 rows=ids if isinstance(ids,list) else (ids.get('data') if isinstance(ids,dict) else [])
 hi=sorted(x for x in rows if isinstance(x,str) and x.startswith('hi_'))
 text=log.read_text(encoding='utf-8',errors='replace') if log.exists() else ''
 errors=[x for x in text.splitlines() if 'Failed to install plugin' in x or 'git dep preparation failed' in x or 'failed to load plugin' in x]
 status='PASS' if len(hi)==32 and {'hi_doctor','hi_status','hi_task_start'}<=set(hi) and not errors else 'FAIL'
 result={'status':status,'kind':'DIRECT_GIT_EXACT_OPENCODE_HOST_ACCEPTANCE','opencode':version,'platform':sys.platform,'architecture':platform.machine().lower(),'binary_sha256':sha256(binary),'spec':spec,'hi_tool_count':len(hi),'hi_tools':hi,'install_or_load_errors':errors[-20:],'last_probe_error':last_error}
 print(json.dumps(result,indent=2,ensure_ascii=False))
 (work/'result.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
 if status!='PASS':print('\n'.join(text.splitlines()[-160:]),file=sys.stderr)
 return 0 if status=='PASS' else 1
if __name__=='__main__':raise SystemExit(main())
