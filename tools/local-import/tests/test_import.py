import copy, hashlib, importlib.util, json, os, pathlib, shutil, signal, subprocess, sys, tempfile, time, unittest, zipfile
HERE=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('local_import',HERE/'import_collection.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
HELPER=os.environ.get('TACITUS_BATCH_AUTHOR_BIN');CORE=os.environ.get('TACITUS_KNOWLEDGE_CAPTURE_BIN')

def digest(b):return hashlib.sha256(b).hexdigest()
def js(p):return json.loads(pathlib.Path(p).read_bytes())

class ImportTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='tacitus-batch-test-');self.base=pathlib.Path(self.temp.name);self.root=self.base/'input';self.root.mkdir();self.now=int(time.time())-10
 def tearDown(self):self.temp.cleanup()
 def fixture(self,count=128,authored=100):
  rows=[]
  for i in range(count):
   # Explicitly fabricated annotation content; importer must never generate these.
   q1=f'Zoë 🧭 states synthetic clearance {i} requires written consent.';q2=f'合成許可 {i} ends if the safety review fails.'
   raw=('\ufeff# Synthetic source '+str(i)+'\r\n'+q1+'\r\n'+q2+'\r\n<script>untrusted</script> https://example.invalid/ never fetch\r\n').encode()
   path=f'doc-{i:03}.md';(self.root/path).write_bytes(raw)
   row=dict(key=f'logical-{i:03}',path=path,sha256=digest(raw),title=f'Synthetic {i}',author='Declared source author',provenance=f'Local invented fixture {i}; not fetched',rights='Synthetic fixture supplied for local tests; rights not verified.',language='mul',confirms_rights=True)
   if i<authored:row['authoring']=dict(annotationAuthor='Explicit annotation author '+str(i),entityKind='institution',entityLabel=f'Fictional council {i}',relation='depends_on',direction='a-b',rationale='Explicit fabricated dependence; no inferred relation.',annotations=[dict(quote=q,proposition=f'User-authored synthetic proposition {i}/{j}',speaker='Zoë (fictional)',modality='conditional; unreviewed',conditions='Written consent and continuing safety review.',exceptions='Fictional test; not real policy.')for j,q in enumerate([q1,q2])])
   rows.append(row)
  self.manifest=dict(format=mod.FORMAT,collection='Synthetic hundred-source collection',author='Batch operator',sources=rows);self.save();return rows
 def save(self): (self.root/'manifest.json').write_text(json.dumps(self.manifest,ensure_ascii=False),encoding='utf-8')
 def command(self,name,previous=None):
  args=[sys.executable,str(HERE/'import_collection.py'),'--root',str(self.root),'--manifest','manifest.json','--output',str(self.base/name),'--checkpoint',str(self.now)]
  if previous:args+=['--previous',str(self.base/previous)]
  if HELPER:args+=['--helper',HELPER,'--helper-sha256',digest(pathlib.Path(HELPER).read_bytes()),'--core',CORE,'--core-sha256',digest(pathlib.Path(CORE).read_bytes())]
  return args
 def invoke(self,name,previous=None,ok=True):
  r=subprocess.run(self.command(name,previous),capture_output=True,timeout=60)
  self.assertEqual(r.returncode,0 if ok else 1,r.stderr.decode());self.assertEqual((self.base/name).exists(),ok)
  self.assertFalse(list(self.base.glob('.'+name+'.stage-*')))
  return json.loads(r.stdout if ok else r.stderr)
 @unittest.skipUnless(HELPER and CORE,'real native batch/core identities required')
 def test_128_exact_sources_native_shards_incremental_and_restart(self):
  rows=self.fixture();receipt=self.invoke('one');out=self.base/'one';m=js(out/'manifest.json')
  self.assertEqual((receipt['sources'],receipt['authored_sources'],receipt['source_only'],receipt['native_capsules'],receipt['native_assertions']),(128,100,28,4,200))
  self.assertEqual(receipt['lexical_receipt']['sources'],128);self.assertEqual(m['complete'],True)
  authored_seen=set()
  for capsule in m['native_capsules']:
   self.assertLessEqual(capsule['sources'],25);self.assertLessEqual(capsule['assertions'],50)
   with zipfile.ZipFile(out/capsule['path'])as z:
    data=json.loads(z.read('capsule.json'));self.assertEqual(len(data['sources']),25)
    for s in data['sources']:
     row=next(r for r in rows if 's-'+digest(mod.enc([self.manifest['collection'],r['key']]))==s['id']);raw=(self.root/row['path']).read_bytes()
     self.assertEqual(z.read('evidence/'+digest((s['id']+'@1').encode())+'.txt'),raw);self.assertEqual(s['text_hash'],digest(raw));authored_seen.add(s['id']);native_manifest=json.loads(z.read('manifest.json'));self.assertIn('Unverified annotation authorship declaration: '+mod.enc({'source':s['id']+'@1','annotation_author':row['authoring']['annotationAuthor']}).decode(),native_manifest['limitations']);self.assertEqual(native_manifest['author'],'Batch operator');self.assertEqual(s['author'],'Declared source author')
    for a in data['assertions']:
     source=next(s for s in data['sources']if s['id']+'@1'==a['evidence'][0]['source']);raw=z.read('evidence/'+digest((source['id']+'@1').encode())+'.txt');span=a['evidence'][0]
     quote=raw[span['start']:span['end']].decode();self.assertIn(quote,[x['quote']for r in rows if r.get('authoring')for x in r['authoring']['annotations']]);self.assertIn(mod.UNREVIEWED,a['conditions']);self.assertEqual(a['epistemic_type'],'reported_statement')
  self.assertEqual(len(authored_seen),100);self.assertFalse(authored_seen & set(m['source_only_ids']))
  # CLI process restart, same declarations: byte-identical manifest/capsules, verified reuse.
  again=self.invoke('two','one');self.assertEqual(again['reused_native_capsules'],4);self.assertEqual(again['lexical_receipt']['reused_source_objects'],128);self.assertEqual(again['lexical_receipt']['rebuilt_index_rows'],0)
  self.assertEqual((out/'manifest.json').read_bytes(),(self.base/'two/manifest.json').read_bytes())
  query={'question':'合成許可','max_bytes':32768}
  response=subprocess.run([sys.executable,str(out/'query/collection.py'),'query',str(out/'lexical')],input=json.dumps(query).encode(),capture_output=True,check=True);context=json.loads(response.stdout);self.assertEqual(context['receipt']['indexed_sources'],128);self.assertGreater(context['receipt']['included_blocks'],0)
  # One authored change, one source-only removal, and identical bytes under a different provenance/key.
  rows[0]['authoring']['annotations'][0]['modality']='Changed explicit qualification';changed_file=self.root/rows[0]['path'];changed_file.write_bytes(changed_file.read_bytes()+'追加の合成追記。\r\n'.encode());rows[0]['sha256']=digest(changed_file.read_bytes());removed=rows.pop();duplicate=copy.deepcopy(rows[126]);duplicate.update(key='duplicate-content',provenance='Different explicit provenance; same bytes');rows.append(duplicate);self.save();self.now+=1
  changed=self.invoke('three','two');n=js(self.base/'three/manifest.json');self.assertEqual(changed['sources'],128);self.assertEqual(changed['reused_native_capsules'],3);self.assertEqual(changed['duplicate_content_groups'],1);self.assertEqual({t['reason']for t in changed['tombstones']},{'removed','replaced'})
  old_id=next(s['id']for s in m['sources']if s['key']=='logical-000');self.assertEqual(next(s['version']for s in n['sources']if s['id']==old_id),2)
  # Readd a removed identity after a process restart: never reuse old native source version.
  rows.append(removed);self.save();self.now+=1;self.invoke('four','three');last=js(self.base/'four/manifest.json');self.assertEqual(next(s['version']for s in last['sources']if s['key']==removed['key']),2)
  # Previous object corruption must fail atomically, even for unchanged source content.
  file=next(x for x in n['files']if x.startswith('lexical/objects/'));(self.base/'three'/file).write_bytes(b'tamper');self.invoke('corrupt','three',ok=False)
  print('EXACT128RESULT '+json.dumps(receipt,sort_keys=True))
 def test_source_only_and_failure_atomicity(self):
  rows=self.fixture(3,0);r=self.invoke('plain');self.assertEqual((r['source_only'],r['native_capsules']),(3,0))
  rows[1]['sha256']='0'*64;rows[2]['path']='../escape.md';self.save();bad=self.invoke('invalid',ok=False);self.assertIn('source_index',bad['error']);self.assertIn('declared source hash mismatch',bad['error']);self.assertIn('unsafe relative path',bad['error'])
  self.assertTrue((self.base/'plain/manifest.json').exists())
 def test_duplicates_paths_utf8_limits_and_existing_output(self):
  for kind in ['duplicate','symlink','directory-symlink','utf8','oversize','fifo','rights','too-many','annotation']:
   rows=self.fixture(2,0)
   if kind=='duplicate':rows[1]['key']=rows[0]['key']
   if kind=='symlink':(self.root/'link.md').symlink_to(self.root/rows[0]['path']);rows[0]['path']='link.md'
   if kind=='directory-symlink':(self.root/'linkdir').symlink_to(self.root,target_is_directory=True);rows[0]['path']='linkdir/'+rows[0]['path']
   if kind=='utf8':(self.root/rows[0]['path']).write_bytes(b'\xff')
   if kind=='oversize':(self.root/rows[0]['path']).write_bytes(b'x'*32769)
   if kind=='fifo':os.mkfifo(self.root/'pipe.md');rows[0]['path']='pipe.md'
   if kind=='rights':rows[0]['confirms_rights']=False
   if kind=='too-many':self.manifest['sources']=rows*129
   if kind=='annotation':rows[0]['authoring']=None
   self.save();self.invoke('bad-'+kind,ok=False)
  self.fixture(1,0);self.invoke('existing');before=(self.base/'existing/manifest.json').read_bytes();r=subprocess.run(self.command('existing'),capture_output=True);self.assertEqual(r.returncode,1);self.assertEqual((self.base/'existing/manifest.json').read_bytes(),before)
  # Duplicate JSON keys fail, instead of last value silently winning.
  (self.root/'manifest.json').write_text('{"format":"a","format":"b"}');self.invoke('dup-json',ok=False)
 def test_self_consistent_rehashed_bad_lexical_cache_refuses(self):
  self.fixture(1,0);self.invoke('good');root=self.base/'good';outer=js(root/'manifest.json');lex=js(root/'lexical/manifest.json');desc=lex['shards'][0];oldname='lexical/shards/'+desc['sha256']+'.json';rows=js(root/oldname);rows[0]['blocks'][0]['terms']=[];body=mod.enc(rows);newhash=digest(body);newname='lexical/shards/'+newhash+'.json';(root/newname).write_bytes(body);(root/oldname).unlink();desc['sha256']=newhash;lexraw=mod.enc(lex);(root/'lexical/manifest.json').write_bytes(lexraw);outer['files'].pop(oldname);outer['files'][newname]=newhash;outer['files']['lexical/manifest.json']=digest(lexraw);(root/'manifest.json').write_bytes(mod.enc(outer));bad=self.invoke('refused','good',ok=False);self.assertIn('subprocess refused',bad['error'])
 @unittest.skipUnless(HELPER and CORE,'real native batch/core identities required')
 def test_byte_bounded_sharding_annotation_errors_and_native_removal(self):
  rows=self.fixture(26,26)
  for row in rows:
   path=self.root/row['path'];raw=path.read_bytes();path.write_bytes(raw+b'x'*(32768-len(raw)));row['sha256']=digest(path.read_bytes())
   for a in row['authoring']['annotations']:a['proposition']='p'*4000
  self.save();receipt=self.invoke('bounded');self.assertGreater(receipt['native_capsules'],1);m=js(self.base/'bounded/manifest.json');self.assertTrue(any(c['sources']<25 for c in m['native_capsules']))
  removed=rows.pop(0);self.save();self.now+=1;receipt=self.invoke('removed','bounded');self.assertEqual(receipt['native_assertions'],50);self.assertEqual(len(receipt['tombstones']),1);self.assertEqual(receipt['tombstones'][0]['reason'],'removed')
  rows[0]['authoring']['annotations'][0]['quote']='missing exact quote';self.save();bad=self.invoke('bad-annotation',ok=False);self.assertIn(rows[0]['key'],bad['error']);self.assertIn('exactly once',bad['error'])
 @unittest.skipUnless(HELPER and CORE,'real native batch/core identities required')
 def test_interruption_cleans_stage_and_never_publishes(self):
  self.fixture(128,128);p=subprocess.Popen(self.command('interrupted'),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  try:
   end=time.monotonic()+10
   while time.monotonic()<end and p.poll()is None:
    if list(self.base.glob('.interrupted.stage-*')):break
    time.sleep(.002)
   self.assertIsNone(p.poll());p.send_signal(signal.SIGTERM);out,err=p.communicate(timeout=15);self.assertNotEqual(p.returncode,0);self.assertFalse((self.base/'interrupted').exists());self.assertFalse(list(self.base.glob('.interrupted.stage-*')))
  finally:
   if p.poll()is None:p.kill();p.wait()
 def test_no_replace_publication_and_symlinked_output_parent(self):
  fd=mod.directory(self.base)
  try:
   (self.base/'stage').mkdir();(self.base/'occupied').mkdir()
   with self.assertRaises(OSError):mod.publish('stage','occupied',fd)
   self.assertTrue((self.base/'stage').is_dir());self.assertTrue((self.base/'occupied').is_dir())
  finally:os.close(fd)
  self.fixture(1,0);(self.base/'parentlink').symlink_to(self.base,target_is_directory=True);args=self.command('unused');args[args.index('--output')+1]=str(self.base/'parentlink/escape');r=subprocess.run(args,capture_output=True);self.assertEqual(r.returncode,1);self.assertFalse((self.base/'escape').exists())

if __name__=='__main__':unittest.main(verbosity=2)
