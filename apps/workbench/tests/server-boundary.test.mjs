import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';

async function start(port,enabled){
 const env={...process.env,PORT:String(port)};delete env.TACITUS_LOCAL_INSPECTOR;delete env.TACITUS_KNOWLEDGE_CAPTURE_BIN;delete env.TACITUS_KNOWLEDGE_CAPTURE_SHA256;delete env.NODE_ENV;delete env.VERCEL;delete env.K_SERVICE;
 if(enabled)env.TACITUS_LOCAL_INSPECTOR='1';
 const child=spawn(process.execPath,['server/index.mjs'],{env,stdio:'ignore',windowsHide:true});const origin=`http://127.0.0.1:${port}`;
 for(let n=0;n<100;n++){try{if((await fetch(origin+'/api/status')).ok)return {child,origin};}catch{}await new Promise(r=>setTimeout(r,50));}
 child.kill();throw new Error('Task-owned server failed to become ready');
}
async function stop(child){child.kill();if(child.exitCode===null)await new Promise(r=>child.once('exit',r));}
test('default disabled server serves recorded data and refuses API before origin checks',async()=>{
 const {child,origin}=await start(4320,false);
 try{assert.equal((await(await fetch(origin+'/api/status')).json()).live,false);assert.equal((await fetch(origin+'/examples/peace.context.json')).status,200);
 for(const from of [origin,'https://example.invalid'])for(const route of ['/api/inspect','/api/collection']){const res=await fetch(origin+route,{method:'POST',headers:{Origin:from,'Content-Type':'application/json'},body:'{}'});assert.equal(res.status,404);assert.equal((await res.json()).error,'inspector_disabled');}
 }finally{await stop(child);}
});
test('enabled outer lock rejects concurrent headers before body and releases on errors and disconnect',async()=>{
 const {child,origin}=await start(4321,true);const pending=[];
 function partial(route='/api/inspect'){let response;const result=new Promise(resolve=>response=resolve);const req=http.request(origin+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','Content-Length':12000000}},res=>{res.resume();response(res.statusCode);});req.on('error',()=>{});req.write('{');pending.push(req);return {req,result};}
 async function small(body,from=origin,route='/api/inspect'){return fetch(origin+route,{method:'POST',headers:{Origin:from,'Content-Type':'application/json'},body});}
 try{
  for(const route of ['/api/inspect','/api/collection'])assert.equal((await small('{}','https://example.invalid',route)).status,403);
  const first=partial();await new Promise(resolve=>setTimeout(resolve,100));
  const second=partial('/api/collection');const status=await Promise.race([second.result,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Concurrent request waited for body')),1500))]);assert.equal(status,429);
  first.req.destroy();second.req.destroy();
  let released;for(let n=0;n<30;n++){released=await small('{');if(released.status!==429)break;await new Promise(r=>setTimeout(r,30));}assert.equal(released.status,400);assert.equal((await released.json()).error,'invalid_json');
  const noCore=await small('{}');assert.equal(noCore.status,503);assert.equal((await noCore.json()).error,'core_not_configured');
  assert.equal((await small('{')).status,400);
  if((await(await fetch(origin+'/api/status')).json()).collection){
   assert.equal((await small(JSON.stringify({question:''}),origin,'/api/collection')).status,400);
   assert.equal((await small(JSON.stringify({question:'q'.repeat(2001)}),origin,'/api/collection')).status,400);
   assert.equal((await small(JSON.stringify({question:'q'.repeat(4096)}),origin,'/api/collection')).status,413);
   assert.equal((await small('{}')).status,503);
  }
  const expiring=partial();assert.equal(await expiring.result,408);
  assert.equal((await small('{}')).status,503);
 }finally{for(const req of pending)req.destroy();await stop(child);}
});
