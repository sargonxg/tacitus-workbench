import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {graphFromContext} from '../src/graph/evidenceGraph.ts';
const text=await readFile('public/examples/peace.context.json','utf8');
const context=JSON.parse(text);
test('native citation links use declared HTTP source references without altering exact evidence',()=>{
 const before=JSON.stringify(context),graph=graphFromContext(context);
 for(const claim of graph.nodes.filter(n=>n.kind==='claim')){
  const supplied=context.context.claims[claim.id.slice('claim:'.length)];
  assert.deepEqual(claim.evidence.map(e=>e.quote),supplied.citations.map(c=>c.text));
  assert.deepEqual(claim.conditions,supplied.assertion.conditions);
  assert.deepEqual(claim.exceptions,supplied.assertion.exceptions);
  assert.equal(claim.metadata.modality,supplied.assertion.modality);
  for(const e of claim.evidence){assert.equal(e.url,context.source_metadata[e.sourceId].document_id);assert.equal(e.verification,'context-excerpt-only');assert.equal(e.textHash,context.source_metadata[e.sourceId].text_hash);}
 }
 assert.equal(JSON.stringify(context),before);
});
test('unsafe native source references remain inert; explicit safe presentation links take precedence',()=>{
 const source=Object.keys(context.source_metadata)[0];
 for(const reference of ['javascript:alert(1)','data:text/html,test','file:///tmp/source','https://name:secret@example.invalid/source','//example.invalid/source','not a source URL']){
  const altered=structuredClone(context);altered.source_metadata[source].document_id=reference;const graph=graphFromContext(altered);
  assert.equal(graph.documents.find(d=>d.id===source).url,undefined);
  assert.ok(graph.nodes.flatMap(n=>n.evidence).filter(e=>e.sourceId===source).every(e=>e.url===undefined));
 }
 const graph=graphFromContext(context,{[source]:{url:'https://example.invalid/explicit-source'}});assert.equal(graph.documents.find(d=>d.id===source).url,'https://example.invalid/explicit-source');
});
test('declared entities keep unreviewed status without assuming an annotation author',()=>{
 const graph=graphFromContext(context),entities=graph.nodes.filter(n=>['actor','institution','event'].includes(n.kind));assert.ok(entities.length>0);
 for(const entity of entities){assert.match(entity.uncertainty,/Authored annotation; unreviewed/);assert.doesNotMatch(entity.uncertainty,/Assistant-authored/);}
});
