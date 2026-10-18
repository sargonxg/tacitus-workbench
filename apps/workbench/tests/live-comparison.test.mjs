import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeLiveRun,compareLiveRuns} from '../src/live-comparison.mjs';
import {createRequestEpoch,wholeContextBlob} from '../src/local-inspector-client.mjs';
import {createInspector,InspectorError} from '../server/local-inspector.mjs';
const raw=await readFile('public/examples/peace.context.json','utf8'),context=JSON.parse(raw);
const query={question:context.context.question,known_as_of:context.context.known_as_of,valid_at:context.context.valid_at,time_mode:'disclose_unknown',max_bytes:65536,revoked_sources:[]};
const input={archive:context.archive_digest,core:'1'.repeat(64),query,raw};
test('real Context preserves bytes, citation selection, unknown dates and frozen request',async()=>{
 const q=structuredClone(query),a=makeLiveRun({...input,query:q});q.known_as_of=1;q.revoked_sources.push('changed');
 assert.equal(a.query.known_as_of,query.known_as_of);assert.deepEqual(a.query.revoked_sources,[]);assert.equal(await wholeContextBlob(a.raw).text(),raw);
 const diff=compareLiveRuns(a,makeLiveRun(input));assert.equal(diff.refused,false);assert.ok(diff.claims.length>0);assert.ok(diff.claims.every(c=>c.status==='same selected claim and temporal disclosure'));
 assert.deepEqual(diff.sources.map(s=>s.id),[...new Set(Object.values(context.context.claims).flatMap(c=>c.citations.map(c=>c.span.source)))].sort());assert.equal(Object.values(a.context.observed_at)[0],null);
});
test('only checkpoints vary; archive, question, budget, policy, core and revocations must match',()=>{
 const a=makeLiveRun(input);for(const [field,value] of [['archive','2'.repeat(64)],['core','2'.repeat(64)]])assert.throws(()=>compareLiveRuns(a,{...a,[field]:value}),/mismatch/);
 for(const [field,value] of [['question','different'],['max_bytes',66000],['time_mode','require_declared_interval'],['revoked_sources',['a']]])assert.throws(()=>compareLiveRuns(a,{...a,query:{...a.query,[field]:value}}),/Unmatched/);
 const c=structuredClone(context);c.context.known_as_of++;const b=makeLiveRun({...input,query:{...query,known_as_of:query.known_as_of+1},raw:JSON.stringify(c)});assert.equal(compareLiveRuns(a,b).claims.length,Object.keys(context.context.claims).length);
});
test('refusal never becomes an empty evidence set or exportable Context',()=>{
 const a=makeLiveRun(input),b=makeLiveRun({...input,raw:null,error:'historical_revision_required',query:{...query,known_as_of:1}}),diff=compareLiveRuns(a,b);
 assert.equal(diff.refused,true);assert.deepEqual(diff.claims,[]);assert.deepEqual(diff.sources,[]);assert.match(diff.message,/No evidence-set difference/);assert.equal(b.raw,null);
});
test('membership and qualification changes disclose actual omissions',()=>{
 const a=makeLiveRun(input),c=structuredClone(context),id=Object.keys(c.context.claims)[0];delete c.context.claims[id];c.context.omissions[id]='bounded test omission';const other=Object.keys(c.context.claims)[0];c.context.claims[other].assertion.conditions.push('synthetic qualifier change');
 const b=makeLiveRun({...input,raw:JSON.stringify(c)}),diff=compareLiveRuns(a,b);assert.equal(diff.claims.find(c=>c.id===id).status,'selected only in A');assert.equal(b.context.context.omissions[id],'bounded test omission');assert.equal(diff.claims.find(c=>c.id===other).status,'claim or citation content differs');
});
test('missing identity, mismatched response and malformed citations refuse projection',()=>{
 for(const core of [null,'','x'.repeat(64)])assert.throws(()=>makeLiveRun({...input,core}));
 for(const key of ['archive_digest','context']){const c=structuredClone(context);if(key==='archive_digest')c[key]='0'.repeat(64);else c.context.known_as_of++;assert.throws(()=>makeLiveRun({...input,raw:JSON.stringify(c)}));}
 const c=structuredClone(context);Object.values(c.context.claims)[0].citations[0].span.end++;assert.throws(()=>makeLiveRun({...input,raw:JSON.stringify(c)}),/citation/);assert.throws(()=>makeLiveRun({...input,raw:'x'.repeat(65537)}),/budget/);
});
test('cancelled and superseded epochs reject later results',()=>{const e=createRequestEpoch(),a=e.begin();e.cancel();assert.equal(e.current(a.id),false);const b=e.begin(),c=e.begin();assert.equal(e.current(b.id),false);assert.equal(e.current(c.id),true);});
test('core identity follows digest validation and survives a genuine refusal',async()=>{
 const bin=process.execPath,digest=createHash('sha256').update(await readFile(bin)).digest('hex'),data={operation:'inspect',archive:Buffer.from([80,75,3,4]).toString('base64')};let verified=null;
 const wrong=createInspector({binary:bin,digest:'0'.repeat(64),runner:()=>{throw Error('must not execute');}});await assert.rejects(wrong(data,undefined,v=>verified=v),{code:'core_digest_mismatch'});assert.equal(verified,null);
 const good=createInspector({binary:bin,digest,runner:async()=>{throw new InspectorError('unknown_validity',422);}});await assert.rejects(good(data,undefined,v=>verified=v),{code:'unknown_validity'});assert.equal(verified,digest);
});

test('omission-only success stays distinct from refusal; malformed observed dates reject projection',()=>{
 const c=structuredClone(context);c.context.claims={};c.context.omissions={all:'budget cannot retain selected claims in this synthetic test'};const run=makeLiveRun({...input,raw:JSON.stringify(c)});const diff=compareLiveRuns(run,run);assert.equal(diff.refused,false);assert.deepEqual(diff.claims,[]);assert.deepEqual(diff.sources,[]);assert.equal(run.context.context.omissions.all,c.context.omissions.all);
 const invalid=structuredClone(context);invalid.observed_at[Object.keys(invalid.context.claims)[0]]={bad:true};assert.throws(()=>makeLiveRun({...input,raw:JSON.stringify(invalid)}),/claim/);
});
test('prototype-like authored claim IDs remain ordinary map keys',()=>{
 for(const name of ['constructor','toString','__proto__']){
 const c=structuredClone(context),first=Object.keys(c.context.claims)[0],layer=c.context.claims[first];delete c.context.claims[first];layer.assertion.id=name;Object.defineProperty(c.context.claims,name,{value:layer,enumerable:true,configurable:true});Object.defineProperty(c.temporal_status,name,{value:'UNKNOWN',enumerable:true});Object.defineProperty(c.observed_at,name,{value:null,enumerable:true});
 const a=makeLiveRun({...input,raw:JSON.stringify(c)}),d=JSON.parse(JSON.stringify(c));delete d.context.claims[name];Object.defineProperty(d.context.omissions,name,{value:'not selected',enumerable:true});const b=makeLiveRun({...input,raw:JSON.stringify(d)});assert.equal(compareLiveRuns(a,b).claims.find(c=>c.id===name).status,'selected only in A');
 }
});
