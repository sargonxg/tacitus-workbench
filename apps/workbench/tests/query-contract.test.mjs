import test from 'node:test';
import assert from 'node:assert/strict';
import {validateInput,createInspector,runCore} from '../server/local-inspector.mjs';

const input=max_bytes=>({operation:'reuse',archive:Buffer.from([80,75,3,4]).toString('base64'),query:{question:'peace',known_as_of:1792328100,valid_at:1792328100,time_mode:'disclose_unknown',max_bytes,revoked_sources:[]}});

test('native query budgets match the pinned core contract',()=>{
  for(const budget of [2048,65536,250000])assert.equal(validateInput(input(budget)).query.max_bytes,budget);
  for(const budget of [256,2047,250001,1048576,2048.5])assert.throws(()=>validateInput(input(budget)),{code:'invalid_query'});
});

test('wrong executable digest refuses before any subprocess runs',async()=>{
  let ran=false;
  const inspector=createInspector({binary:process.execPath,digest:'0'.repeat(64),runner:async()=>{ran=true;}});
  await assert.rejects(inspector(input(65536)),{code:'core_digest_mismatch'});assert.equal(ran,false);
});

test('subprocess timeout and output limits terminate execution',async()=>{
  await assert.rejects(runCore(process.execPath,['-e','setTimeout(()=>{},10000)'],'',{timeout:50}),{code:'core_timeout'});
  await assert.rejects(runCore(process.execPath,['-e',"process.stdout.write('x'.repeat(4096))"],'',{output:128}),{code:'core_output_limit'});
});
