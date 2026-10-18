"""Matched exact native queries over128/256 sources; no generated answers."""
import base64, copy, hashlib, importlib.util, json, os, pathlib, signal, subprocess, sys, tempfile, time, unittest
import test_import as f
sys.path.insert(0,str(f.HERE));import query_collection as query

@unittest.skipUnless(f.HELPER and f.CORE,'real batch helper and native core required')
class CollectionQueryTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.h=f.ImportTests();cls.h.setUp();cls.h.fixture(128,100);cls.h.invoke('s128');cls.h.fixture(256,256);cls.h.invoke('s256');cls.corehash=f.digest(pathlib.Path(f.CORE).read_bytes())
 @classmethod
 def tearDownClass(cls):cls.h.tearDown()
 def request(self,name='s128',budget=2*1024*1024):
  root=self.h.base/name;raw=(root/'manifest.json').read_bytes();m=json.loads(raw)
  return dict(format=query.REQUEST,manifest_sha256=f.digest(raw),snapshot_sha256=m['snapshot_sha256'],question='Fictional council',known_as_of=self.h.now,valid_at=self.h.now,time_mode='disclose_unknown',max_bytes=budget,revoked_sources=[],revoked_capsules=[])
 def run_cli(self,q,root='s128',ok=True):
  path=self.h.base/'query.json';path.write_bytes(f.mod.enc(q));r=subprocess.run([sys.executable,str(f.HERE/'query_collection.py'),'--collection',str(self.h.base/root),'--request',str(path),'--core',f.CORE,'--core-sha256',self.corehash],capture_output=True,timeout=70)
  self.assertEqual(r.returncode,0 if ok else 1,r.stderr.decode())
  if not ok:self.assertEqual(r.stdout,b'');return json.loads(r.stderr)
  self.assertLessEqual(len(r.stdout),q['max_bytes']);return r.stdout
 def test_matched_128_and_256_exact_child_bytes_qualifiers_and_global_limits(self):
  for name,total,authored,caps,claims in [('s128',128,100,4,200),('s256',256,256,11,512)]:
   q=self.request(name);raw=self.run_cli(q,name);out=json.loads(raw);m=f.js(self.h.base/name/'manifest.json');self.assertEqual(out['coverage']['declared_sources'],total);self.assertEqual(out['coverage']['authored_sources'],authored);self.assertEqual(out['coverage']['executed_capsules'],caps);self.assertEqual(len(out['records']),caps)
   self.assertEqual(raw,self.run_cli(q,name));members=[];selected=0
   for record in out['records']:
    child=base64.b64decode(record['context_base64'],validate=True);self.assertEqual(f.digest(child),record['context_sha256']);self.assertEqual(len(child),record['native_bytes']);cap=next(c for c in m['native_capsules']if c['archive_sha256']==record['capsule_archive_sha256']);native_q={k:q[k]for k in ('question','known_as_of','valid_at','time_mode')};native_q.update(max_bytes=record['native_max_bytes'],revoked_sources=[])
    direct=subprocess.run([f.CORE,'reuse',str(self.h.base/name/cap['path'])],input=f.mod.enc(native_q),capture_output=True,check=True,env={});self.assertEqual(child,direct.stdout);p=json.loads(child);self.assertEqual(len(p['context']['claims']),record['selected_claims']);self.assertEqual(len(p['context']['omissions']),record['native_omission_entries']);self.assertEqual(f.digest(f.mod.enc(p['context']['omissions'])),record['native_omissions_sha256']);members.extend(s['source']for s in record['member_sources']);selected+=record['selected_claims']
    for value in p['context']['claims'].values():
     a=value['assertion'];self.assertIn(f.mod.UNREVIEWED,a['conditions']);self.assertEqual(a['modality'],'conditional; unreviewed');self.assertIn('Fictional test; not real policy.',a['exceptions']);self.assertEqual(value['knowledge'],'unknown');self.assertEqual(a['epistemic_type'],'reported_statement')
   self.assertEqual(len(members),len(set(members)));self.assertEqual(len(members),authored);self.assertEqual(out['coverage']['selected_claims'],claims);self.assertEqual(selected,claims);self.assertLessEqual(sum(r['native_max_bytes']for r in out['records']),q['max_bytes']);self.assertEqual(out['coverage']['source_only_sources'],total-authored)
   print('MATCHEDQUERY '+json.dumps(dict(sources=total,capsules=caps,selected_claims=selected,bytes=len(raw),budget=q['max_bytes'],child_limits=[r['native_max_bytes']for r in out['records']]),sort_keys=True))
 def test_global_250k_budget_omissions_and_minimum_boundary(self):
  q=self.request(budget=250000);q['question']='Fictional council 合成許可 Zoë 🧭';raw=self.run_cli(q);out=json.loads(raw);self.assertLess(out['coverage']['selected_claims'],200);self.assertTrue(any(r['native_omission_entries']for r in out['records']));self.assertLessEqual(len(raw),250000)
  m=f.js(self.h.base/'s128/manifest.json');mapping,caps=query.validate_manifest(m,q);envelope=query.frame(m,q,caps,mapping);overhead=len(f.mod.enc(envelope))+1;minimum=overhead+len(caps)*4*((2048+2)//3)
  self.assertTrue(all(n>=2048 for n in query.allocate(envelope,minimum)))
  with self.assertRaises(query.Refusal):query.allocate(envelope,minimum-1)
  bad=self.request(budget=4096);error=self.run_cli(bad,ok=False);self.assertEqual(error['error'],'global_budget_cannot_hold_all_child_minimums_and_receipt')
 def test_refusals_manifest_revocations_unknown_refs_strict_early(self):
  m=f.js(self.h.base/'s128/manifest.json')
  changes=[{'manifest_sha256':'0'*64},{'snapshot_sha256':'0'*64},{'revoked_sources':['unknown@1']},{'revoked_capsules':['0'*64]},{'revoked_sources':[m['sources'][-1]['id']+'@1']},{'revoked_capsules':[m['native_capsules'][0]['archive_sha256']]},{'time_mode':'require_declared_interval'},{'known_as_of':self.h.now-1}]
  for change in changes:q=self.request();q.update(change);self.run_cli(q,ok=False)
 def test_tampered_last_capsule_mismatch_membership_and_unknown_native_refs(self):
  import shutil
  base=self.h.base/'tampered';shutil.copytree(self.h.base/'s128',base);q=self.request('tampered');m=f.js(base/'manifest.json');p=base/m['native_capsules'][-1]['path'];p.write_bytes(p.read_bytes()+b'tamper');self.run_cli(q,'tampered',ok=False)
  for alter in [lambda m:m['native_capsules'].pop(),lambda m:m['native_capsules'][0]['source_ids'].__setitem__(0,m['source_only_ids'][0]),lambda m:m['native_capsules'][0].__setitem__('assertions',999),lambda m:m['native_capsules'][0].__setitem__('checkpoint',0)]:
   m=f.js(self.h.base/'s128/manifest.json');q=self.request();alter(m)
   with self.assertRaises(query.Refusal):query.validate_manifest(m,q)
  # A forged child response referencing a different source never escapes as success.
  cap=f.js(self.h.base/'s128/manifest.json')['native_capsules'][0];m=f.js(self.h.base/'s128/manifest.json');mapping,_=query.validate_manifest(m,self.request());expected=query.capsule_data(self.h.base/'s128'/cap['path'],cap,m,mapping);q=self.request();nq={k:q[k]for k in('question','known_as_of','valid_at','time_mode')};nq.update(max_bytes=250000,revoked_sources=[]);r=subprocess.run([f.CORE,'reuse',str(self.h.base/'s128'/cap['path'])],input=f.mod.enc(nq),capture_output=True,check=True);out=json.loads(r.stdout);first=next(iter(out['context']['claims'].values()));first['citations'][0]['span']['source']='unknown@1'
  with self.assertRaises(query.Refusal):query.validate_context(f.mod.enc(out),cap,expected,q,250000)
  out=json.loads(r.stdout);out['context']['omissions']['unknown-claim']='invented'
  with self.assertRaises(query.Refusal):query.validate_context(f.mod.enc(out),cap,expected,q,250000)
  out=json.loads(r.stdout);cid=next(iter(out['observed_at']));out['observed_at'][cid]=123
  with self.assertRaises(query.Refusal):query.validate_context(f.mod.enc(out),cap,expected,q,250000)
 def test_source_only_cleanup_cancellation_and_late_child_failure(self):
  self.h.fixture(2,0);self.h.invoke('source-only');error=self.run_cli(self.request('source-only'),'source-only',ok=False);self.assertEqual(error['error'],'source_only_collection_use_lexical_query')
  q=self.request();root=self.h.base/'temporary';root.mkdir();original=query.imp.run;calls=[]
  def fail_last(args,*a,**k):
   if args[1]=='reuse':
    calls.append(str(args[2]))
    if len(calls)==4:raise ValueError('late child refusal')
   return original(args,*a,**k)
  query.imp.run=fail_last
  try:
   with self.assertRaises(query.Refusal):query.query_collection(self.h.base/'s128',q,f.CORE,self.corehash,temp_root=root)
   self.assertEqual(len(calls),4);self.assertEqual(list(root.iterdir()),[])
  finally:query.imp.run=original
  # A real child timeout on the last packet must also clean all staged material.
  calls.clear()
  def timeout_last(args,*a,**k):
   if args[1]=='reuse':
    calls.append(str(args[2]))
    if len(calls)==4:return original([sys.executable,'-c','import time;time.sleep(1)'],timeout=.01)
   return original(args,*a,**k)
  query.imp.run=timeout_last
  try:
   with self.assertRaises(query.Refusal):query.query_collection(self.h.base/'s128',q,f.CORE,self.corehash,temp_root=root)
   self.assertEqual(len(calls),4);self.assertEqual(list(root.iterdir()),[])
  finally:query.imp.run=original
  # Actual SIGTERM during private staging; no stdout or retained private stage.
  request_path=self.h.base/'signal-request.json';request_path.write_bytes(f.mod.enc(self.request('s256')));env={**os.environ,'TMPDIR':str(root)};p=subprocess.Popen([sys.executable,str(f.HERE/'query_collection.py'),'--collection',str(self.h.base/'s256'),'--request',str(request_path),'--core',f.CORE,'--core-sha256',self.corehash],stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env)
  try:
   end=time.monotonic()+5
   while p.poll()is None and time.monotonic()<end:
    if list(root.glob('tacitus-collection-query-*')):break
    time.sleep(.001)
   self.assertIsNone(p.poll());self.assertTrue(list(root.glob('tacitus-collection-query-*')));p.send_signal(signal.SIGTERM);stdout,stderr=p.communicate(timeout=15);self.assertNotEqual(p.returncode,0);self.assertEqual(stdout,b'');self.assertEqual(list(root.iterdir()),[])
  finally:
   if p.poll()is None:p.kill();p.wait()

if __name__=='__main__':unittest.main(verbosity=2)
