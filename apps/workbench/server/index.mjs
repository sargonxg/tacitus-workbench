import {createAuthor,AUTHOR_LIMITS} from './local-author.mjs';
import {existsSync} from 'node:fs';
import {runCore} from './local-inspector.mjs';
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname} from 'node:path';
import {localAccess,boundedBody,createInspector,InspectorError} from './local-inspector.mjs';

const port=Number(process.env.PORT??4317);
if(!Number.isInteger(port)||port<1024||port>65535) throw new Error('Invalid local port');
const origin=`http://127.0.0.1:${port}`;
const dist=fileURLToPath(new URL('../dist/',import.meta.url));
const live=process.env.TACITUS_LOCAL_INSPECTOR==='1'&&process.env.NODE_ENV!=='production'&&!process.env.VERCEL&&!process.env.K_SERVICE&&!!process.env.TACITUS_KNOWLEDGE_CAPTURE_BIN&&!!process.env.TACITUS_KNOWLEDGE_CAPTURE_SHA256;
const inspect=createInspector({binary:process.env.TACITUS_KNOWLEDGE_CAPTURE_BIN,digest:process.env.TACITUS_KNOWLEDGE_CAPTURE_SHA256});
const collectionRoot=fileURLToPath(new URL('../../../examples/diplomacy-1914-v2/.data/',import.meta.url));
const collectionReady=existsSync(resolve(collectionRoot,'lexical-index/manifest.json'));
const author=createAuthor({binary:process.env.TACITUS_CAPTURE_AUTHOR_BIN,digest:process.env.TACITUS_CAPTURE_AUTHOR_SHA256});
const authoring=live&&process.env.TACITUS_LOCAL_AUTHORING==='1'&&!!process.env.TACITUS_CAPTURE_AUTHOR_BIN&&!!process.env.TACITUS_CAPTURE_AUTHOR_SHA256;
let activeRequest=false;
const types={'.zip':'application/zip','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};
export const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  const abort=new AbortController();req.on('aborted',()=>abort.abort());res.on('close',()=>{if(!res.writableEnded)abort.abort();});
  try{
    if(req.headers.host!==new URL(origin).host)throw new InspectorError('host_denied',403);
    const path=new URL(req.url,origin).pathname;
    if(req.method==='GET'&&path==='/api/status'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({live,origin,authoring,collection:collectionReady&&process.env.TACITUS_LOCAL_INSPECTOR==='1'&&process.env.NODE_ENV!=='production'&&!process.env.VERCEL&&!process.env.K_SERVICE}));return;}
    if(req.method==='POST'&&['/api/inspect','/api/collection','/api/author'].includes(path)){
      const boundary=new Request(origin+path,{method:'POST',headers:req.headers});
      localAccess(boundary,{...process.env,TACITUS_INSPECTOR_ORIGIN:origin});
      if(path==='/api/author'&&!authoring)throw new InspectorError('author_disabled',404);
      if(activeRequest){res.setHeader('Connection','close');throw new InspectorError('inspector_busy',429);}
      activeRequest=true;
      try{
        const request=new Request(origin+path,{method:'POST',headers:req.headers,body:Readable.toWeb(req),duplex:'half',signal:abort.signal});
        if(path==='/api/author'){const deadline=Date.now()+AUTHOR_LIMITS.timeout;const input=await boundedBody(request,AUTHOR_LIMITS.body,AUTHOR_LIMITS.timeout);const result=await author(input,abort.signal,deadline);res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition','attachment; filename=local-capture.native-v2.zip');res.setHeader('X-Tacitus-Archive-SHA256',result.digest);res.setHeader('X-Tacitus-Checkpoint',String(result.checkpoint));res.end(result.archive);return;}
        let result;
        if(path==='/api/collection'){
          if(!collectionReady)throw new InspectorError('collection_not_prepared',503);
          const input=await boundedBody(request,4096);
          if(!input||typeof input.question!=='string'||!input.question.trim()||Buffer.byteLength(input.question)>2000)throw new InspectorError('invalid_query');
          result=await runCore('/usr/bin/python3',[resolve(collectionRoot,'collection-adapter/collection.py'),'query',resolve(collectionRoot,'lexical-index')],JSON.stringify({question:input.question,max_bytes:32768}),{signal:abort.signal,output:32768});
        }else result=await inspect(await boundedBody(request),abort.signal,digest=>res.setHeader('X-Tacitus-Core-SHA256',digest));
        res.setHeader('Content-Type','application/json');res.end(result);return;
      }finally{activeRequest=false;}
    }
    if(req.method!=='GET')throw new InspectorError('method_denied',405);
    const relative=path==='/'?'index.html':decodeURIComponent(path).slice(1);
    const file=resolve(dist,relative);
    if(!file.startsWith(resolve(dist)+sep)||!types[extname(file)])throw new InspectorError('not_found',404);
    const bytes=await readFile(file);res.setHeader('Content-Type',types[extname(file)]);res.end(bytes);
  }catch(error){if(res.destroyed)return;if(req.method==='POST')res.setHeader('Connection','close');res.statusCode=error instanceof InspectorError?error.status:404;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:error instanceof InspectorError?error.code:'not_found'}));}
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(port,'127.0.0.1',()=>console.log(`Local evidence inspector: ${origin}; live ${live?'configured':'disabled'}`));
