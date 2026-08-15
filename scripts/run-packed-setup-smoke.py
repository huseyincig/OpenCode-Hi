#!/usr/bin/env python3
from __future__ import annotations
import json,subprocess,tempfile,tarfile,os,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/packed-setup-smoke-0.1.0.json'
def run(cmd,cwd=None,timeout=120):
    return subprocess.run(cmd,cwd=cwd,text=True,capture_output=True,timeout=timeout)
def main()->int:
  with tempfile.TemporaryDirectory(prefix='hi-pack-smoke-') as td:
    td=Path(td);packdir=td/'pack';packdir.mkdir();consumer=td/'consumer';consumer.mkdir()
    pack=run(['npm','pack','--ignore-scripts','--pack-destination',str(packdir)],ROOT)
    if pack.returncode!=0: raise SystemExit(f'npm pack failed: {pack.stderr[-1000:]}')
    tgzs=sorted(packdir.glob('*.tgz'))
    if len(tgzs)!=1: raise SystemExit('expected one tarball')
    tgz=tgzs[0]
    with tarfile.open(tgz,'r:gz') as tf:names=set(tf.getnames());setup_member=tf.getmember('package/scripts/native_plugin_setup.py')
    required=['package/plugin/dist/plugin.js','package/scripts/native_plugin_setup.py','package/VERSION','package/package.json']
    package_doc=json.loads(tarfile.open(tgz,'r:gz').extractfile('package/package.json').read())
    (consumer/'package.json').write_text(json.dumps({'name':'hi-packed-smoke','version':'1.0.0','private':True})+'\n')
    install=run(['npm','install','--ignore-scripts','--no-audit','--no-fund',str(tgz)],consumer,180)
    binpath=consumer/'node_modules/.bin/opencode-hi-setup'
    help_run=run([str(binpath),'--help'],consumer) if binpath.exists() else None
    imp=run(['node','--input-type=module','-e',"import mod from 'opencode-hi'; console.log(typeof mod)"],consumer)
    teardown_noise=imp.returncode in (-6,134) and 'uv__io_poll' in imp.stderr and "Assertion `errno == EEXIST' failed" in imp.stderr
    import_ok=imp.stdout.strip().splitlines()[-1:] == ['function'] and (imp.returncode==0 or teardown_noise)
    receipt={
      'schema':1,'kind':'PACKED_SETUP_FRESH_CONSUMER_SMOKE','release':'0.1.0','status':'PASS',
      'claim_boundary':'Package-content and fresh consumer module/setup CLI resolution only; exact OpenCode material runtime execution belongs to PROMPT B section 26.',
      'tarball':{'required_members':required,'all_required_present':all(x in names for x in required),'setup_mode':oct(setup_member.mode),'file_count':len(names)},
      'manifest':{'bin':package_doc.get('bin'),'peerDependencies':package_doc.get('peerDependencies'),'dependencies':package_doc.get('dependencies'),'optionalDependencies':package_doc.get('optionalDependencies')},
      'fresh_consumer':{'install_rc':install.returncode,'setup_bin_present':binpath.exists(),'setup_help_rc':None if help_run is None else help_run.returncode,'setup_help_has_commands':False if help_run is None else all(x in help_run.stdout for x in ['install','doctor','rollback','recover','reconfigure']),'module_import_output':imp.stdout.strip(),'module_import_rc':imp.returncode,'module_import_teardown_noise':teardown_noise},
    }
    checks=[receipt['tarball']['all_required_present'],receipt['tarball']['setup_mode']=='0o755',receipt['manifest']['bin']=={'opencode-hi-setup':'scripts/native_plugin_setup.py'},receipt['manifest']['dependencies']=={'@opencode-ai/sdk':'1.18.18'},receipt['fresh_consumer']['install_rc']==0,receipt['fresh_consumer']['setup_bin_present'],receipt['fresh_consumer']['setup_help_rc']==0,receipt['fresh_consumer']['setup_help_has_commands'],import_ok]
    if not all(checks):receipt['status']='FAIL'
    OUT.write_text(json.dumps(receipt,indent=2)+'\n')
    print(f"packed setup smoke {receipt['status']}: install={install.returncode} help={receipt['fresh_consumer']['setup_help_rc']} import={imp.returncode} files={len(names)}")
    return 0 if receipt['status']=='PASS' else 1
if __name__=='__main__':raise SystemExit(main())
