import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

test('guide counts and download identities agree with the actual archived corpus and captures',async()=>{
 const check=spawnSync('python3',['../../scripts/prepare-onboarding.py','--check'],{encoding:'utf8'});assert.equal(check.status,0,check.stderr);
 const actual=spawnSync('python3',['-c',`
import zipfile,json
with zipfile.ZipFile('../../examples/july-1914/example-data.zip') as z:
 july=json.loads(z.read('july-1914-evidence/annotations/capture.json'))
with zipfile.ZipFile('../../examples/diplomacy-1914-v2/example-data.zip') as z:
 corpus=json.loads(z.read('diplomacy-1914-expanded/corpus-index.json'))
 expanded=json.loads(z.read('diplomacy-1914-expanded/annotations/expanded/capture.json'))
print(json.dumps({'records':len(corpus['documents']),'memoirs':sum(d['source_kind']=='retrospective_memoir_section' for d in corpus['documents']),'july':[len(july['documents']),len(july['assertions'])],'expanded':[len(expanded['documents']),len(expanded['assertions'])]}))
`],{encoding:'utf8'});assert.equal(actual.status,0,actual.stderr);
 const expected=JSON.parse(actual.stdout),facts=JSON.parse(await readFile('public/examples/onboarding-facts.json','utf8'));
 assert.equal(facts.collection.records,expected.records);assert.equal(facts.collection.retrospective_sections,expected.memoirs);assert.equal(facts.collection.publisher_records,expected.records-expected.memoirs);
 for(const [key,directory] of [['july','july-1914'],['expanded','diplomacy-1914-v2']]){
  const capsule=facts.capsules[key];assert.deepEqual([capsule.sources,capsule.unreviewed_assertions],expected[key]);
  const name=capsule.href.split('/').at(-1);const bytes=await readFile('public'+capsule.href);assert.deepEqual(bytes,await readFile(`../../examples/${directory}/${name}`));assert.equal(createHash('sha256').update(bytes).digest('hex'),capsule.sha256);
 }
});
