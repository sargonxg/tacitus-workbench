"""Actual maximum-count and combined-near-limit imports, no performance claim."""
import json, os, pathlib, unittest
import test_import as fixtures

@unittest.skipUnless(fixtures.HELPER and fixtures.CORE,'real native batch/core identities required')
class ScalingTests(unittest.TestCase):
 def setUp(self):self.h=fixtures.ImportTests();self.h.setUp()
 def tearDown(self):self.h.tearDown()
 def test_256_explicitly_authored_documents(self):
  self.h.fixture(256,256);r=self.h.invoke('maximum');m=fixtures.js(self.h.base/'maximum/manifest.json')
  self.assertEqual((r['sources'],r['source_only'],r['native_assertions']),(256,0,512));self.assertEqual(r['native_capsules'],11);self.assertEqual(sum(c['sources']for c in m['native_capsules']),256)
  print('MAXIMUM256RESULT '+json.dumps(r,sort_keys=True))
 def test_256_combined_near_limits(self):
  rows=self.h.fixture(256,256)
  for row in rows:
   p=self.h.root/row['path'];raw=p.read_bytes();p.write_bytes(raw+b'x'*(32768-len(raw)));row['sha256']=fixtures.digest(p.read_bytes())
   for a in row['authoring']['annotations']:
    a['proposition']='p'*4000;a['conditions']='\n'.join('c'*1000 for _ in range(8));a['exceptions']='\n'.join('e'*500 for _ in range(5))
  self.h.save();manifest_bytes=(self.h.root/'manifest.json').stat().st_size;self.assertLess(manifest_bytes,8*1024*1024)
  r=self.h.invoke('near-limit');m=fixtures.js(self.h.base/'near-limit/manifest.json');self.assertEqual(r['sources'],256);self.assertEqual(r['native_assertions'],512);self.assertEqual(sum(c['sources']for c in m['native_capsules']),256);self.assertTrue(all((self.h.base/'near-limit'/c['path']).stat().st_size<=1024*1024 for c in m['native_capsules']))
  print('COMBINED256RESULT '+json.dumps(dict(receipt=r,manifest_bytes=manifest_bytes,total_source_bytes=256*32768,native_capsules=len(m['native_capsules']),max_capsule_bytes=max((self.h.base/'near-limit'/c['path']).stat().st_size for c in m['native_capsules'])),sort_keys=True))
  import sys;sys.path.insert(0,str(fixtures.HERE));import query_collection as query
  request=dict(format=query.REQUEST,manifest_sha256=fixtures.digest((self.h.base/'near-limit/manifest.json').read_bytes()),snapshot_sha256=m['snapshot_sha256'],question='Fictional council',known_as_of=self.h.now,valid_at=self.h.now,time_mode='disclose_unknown',max_bytes=2097152,revoked_sources=[],revoked_capsules=[])
  encoded=query.query_collection(self.h.base/'near-limit',request,fixtures.CORE,fixtures.digest(pathlib.Path(fixtures.CORE).read_bytes()));out=json.loads(encoded);self.assertLessEqual(len(encoded),request['max_bytes']);self.assertEqual(out['coverage']['executed_capsules'],len(m['native_capsules']));self.assertEqual(sum(x['selected_claims']+x['native_omission_entries']for x in out['records']),512)
  print('COMBINED256QUERY '+json.dumps(dict(bytes=len(encoded),selected_claims=out['coverage']['selected_claims'],omissions=sum(x['native_omission_entries']for x in out['records']),capsules=len(out['records'])),sort_keys=True))

if __name__=='__main__':unittest.main(verbosity=2)
