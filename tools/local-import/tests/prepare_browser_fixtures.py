#!/usr/bin/env python3
"""Test data only, using unchanged importer/query formats. No model or URL fetch."""
import argparse, base64, hashlib, importlib.util, json, os, pathlib, subprocess, sys, tempfile, time, zipfile
HERE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import test_import as fixtures
REPO=HERE.parents[2]

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',required=True);a=p.parse_args();out=pathlib.Path(a.output).absolute()
 if out.exists():raise ValueError('fresh fixture output required')
 for key in ('TACITUS_BATCH_AUTHOR_BIN','TACITUS_KNOWLEDGE_CAPTURE_BIN'):
  if not os.environ.get(key):raise ValueError('configured reviewed helper/core required: '+key)
 out.mkdir(mode=0o700);checkpoint=int(time.time())-30;receipts={}
 def run(root,name,synthetic):
  args=[sys.executable,str(HERE.parent/'import_collection.py'),'--root',str(root),'--manifest','manifest.json','--output',str(out/name),'--checkpoint',str(checkpoint)]
  for env,flag in [('TACITUS_BATCH_AUTHOR_BIN','helper'),('TACITUS_KNOWLEDGE_CAPTURE_BIN','core')]:
   binary=os.environ[env];args+=['--'+flag,binary,'--'+flag+'-sha256',hashlib.sha256(pathlib.Path(binary).read_bytes()).hexdigest()]
  response=subprocess.run(args,capture_output=True,check=True);mraw=(out/name/'manifest.json').read_bytes();m=json.loads(mraw);identity=dict(manifest_sha256=hashlib.sha256(mraw).hexdigest(),snapshot_sha256=m['snapshot_sha256'])
  receipts[name]=dict(**identity,synthetic=synthetic,sources=len(m['sources']),capsules=len(m['native_capsules']),assertions=sum(c['assertions']for c in m['native_capsules']))
  if m['native_capsules']:
   q=dict(format='tacitus-native-collection-query/1',**identity,question='Fictional council 合成許可 Zoë 🧭',known_as_of=checkpoint,valid_at=checkpoint,time_mode='disclose_unknown',max_bytes=250000 if name=='synthetic128' else 2097152,revoked_sources=[],revoked_capsules=[])
   (out/(name+'-request.json')).write_text(json.dumps(q,ensure_ascii=False))
   r=subprocess.run([sys.executable,str(HERE.parent/'query_collection.py'),'--collection',str(out/name),'--request',str(out/(name+'-request.json'))],capture_output=True,check=True)
   (out/(name+'-query.exact.json')).write_bytes(r.stdout)
 for name,count,authored in [('synthetic128',128,100),('synthetic256',256,256)]:
  h=fixtures.ImportTests();h.setUp()
  try:h.fixture(count,authored);run(h.root,name,True)
  finally:h.tearDown()
 # Actual FRUS public-domain text, no invented authored relations to fit a profile.
 with tempfile.TemporaryDirectory(prefix='tacitus-frus-browser-fixture-')as temp:
  root=pathlib.Path(temp);rows=[]
  with zipfile.ZipFile(REPO/'examples/july-1914/july-1914.native-v2.zip')as z:
   data=json.loads(z.read('capsule.json'))
   for source_id in ('frus1914Supp-d24','frus1914Supp-d25'):
    s=next(s for s in data['sources']if s['id']==source_id);key=s['id']+'@'+str(s['version']);body=z.read('evidence/'+hashlib.sha256(key.encode()).hexdigest()+'.txt');path=s['id']+'.txt';(root/path).write_bytes(body)
    rows.append(dict(key=s['id'],path=path,sha256=hashlib.sha256(body).hexdigest(),title=s['title'],author=s['author'],provenance=s['document_id'],rights=s['license'],language=s['language'],confirms_rights=True))
  (root/'manifest.json').write_text(json.dumps(dict(format='tacitus-local-import/1',collection='FRUS July 1914: exact source-only browser example',author='Workbench fixture preparation; source and rights declarations unverified',sources=rows),ensure_ascii=False));run(root,'frus2',False)
 failure=dict(format='tacitus-native-collection-error/1',execution_complete=False,error='source_only_collection_use_lexical_query')
 (out/'unbound-error.json').write_text(json.dumps(failure)+'\n');(out/'fixtures.json').write_text(json.dumps(receipts,indent=2)+'\n');print(json.dumps({'output':str(out),'fixtures':receipts},indent=2))

if __name__=='__main__':main()
