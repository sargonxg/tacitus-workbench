import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,readdir,rm,writeFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readLocalText,buildLocalCapture} from '../src/local-author-client.mjs';
import {validateAuthor,createAuthor} from '../server/local-author.mjs';
import {authorForm,quotes} from './author-fixture.mjs';
const bytes=await readFile('tests/fixtures/synthetic-local.md'),source=await readLocalText(new File([bytes],'synthetic.md'));
const payload=()=>buildLocalCapture(source,authorForm());
test('BOM, CRLF and multibyte source/quote bytes are preserved without normalization',()=>{
 assert.deepEqual(Buffer.from(source.text),bytes);assert.equal(source.text.charCodeAt(0),0xfeff);assert.ok(source.text.includes('\r\n'));
 const p=payload();validateAuthor(p);for(const [i,a] of p.capture.assertions.entries()){const span=a.evidence[0];assert.equal(bytes.subarray(span.start,span.end).toString('utf8'),quotes[i]);}assert.equal(p.capture.documents.length,1);assert.equal(p.capture.assertions.length,2);assert.equal(p.capture.manifest.confidentiality,'private');assert.deepEqual(p.capture.graph.knowledge,{});assert.equal(p.capture.documents[0].valid_from,null);
});
test('unsupported files, invalid UTF-8, empty/NUL/oversize source refuse',async()=>{
 for(const file of [new File([bytes],'file.pdf'),new File([new Uint8Array([255])],'bad.md'),new File(['\0'],'nul.txt'),new File(['x'.repeat(32769)],'big.txt'),new File([''],'empty.txt')])await assert.rejects(readLocalText(file));
});
test('no rights, fabricated default relation or ambiguous/overlapping quotes can be packed',()=>{
 for(const field of ['confirmsRights','relation','direction','entityKind']){const f=authorForm();f[field]=field==='confirmsRights'?false:'';assert.throws(()=>buildLocalCapture(source,f));}
 for(const text of [source.text+'\n'+quotes[0],'aaa']){const f=authorForm();if(text==='aaa')f.annotations[0].quote='aa';assert.throws(()=>buildLocalCapture({...source,text},f),/exactly once/);}
 const multiline=authorForm();multiline.annotations[0].quote='not\na source';assert.throws(()=>buildLocalCapture(source,multiline),/single-line/);
 const multilinePayload=payload();multilinePayload.quotes[0]='not\na source';assert.throws(()=>validateAuthor(multilinePayload),{code:'quote_missing_or_ambiguous'});
 const p=payload();p.capture.assertions[0].evidence[0].start++;assert.throws(()=>validateAuthor(p),{code:'quote_span_mismatch'});
 const bad=payload();bad.capture.documents[0].text+='tampered';assert.throws(()=>validateAuthor(bad),{code:'source_hash_mismatch'});
});
test('author declarations and annotations have independent bounds and unknown time guards',()=>{
 for(const change of [p=>p.capture.confirms_rights=false,p=>p.capture.documents[0].published_at=1,p=>p.capture.assertions[0].conditions.push('x'.repeat(2001)),p=>p.capture.graph.knowledge.subject='reported_true',p=>p.capture.graph.links=[],p=>p.capture.observed_at['claim-a']=1]){const p=payload();change(p);assert.throws(()=>validateAuthor(p));}
});
test('wrong helper identity refuses before any subprocess/temp files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'tacitus-author-test-'));let ran=false;
 try{await assert.rejects(createAuthor({binary:process.execPath,digest:'0'.repeat(64),tempRoot:root,runner:()=>{ran=true;}})(payload()),{code:'author_digest_mismatch'});assert.equal(ran,false);assert.deepEqual(await readdir(root),[]);}finally{await rm(root,{recursive:true,force:true});}
});
test('cancellation, repeated submit and request deadline leave no temporary source/archive',async()=>{
 const root=await mkdtemp(join(tmpdir(),'tacitus-author-test-')),digest=createHash('sha256').update(await readFile(process.execPath)).digest('hex'),controller=new AbortController();let entered;const ready=new Promise(r=>entered=r);
 const run=createAuthor({binary:process.execPath,digest,tempRoot:root,runner:async(_b,args,_stdin,{signal})=>{assert.equal((await stat(args[0])).mode&0o777,0o600);entered();return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('cancelled test')),{once:true}));}});
 try{const pending=run(payload(),controller.signal);await ready;await assert.rejects(run(payload()),{code:'inspector_busy'});controller.abort();await assert.rejects(pending);assert.deepEqual(await readdir(root),[]);await assert.rejects(run(payload(),undefined,Date.now()-1),{code:'author_timeout'});assert.deepEqual(await readdir(root),[]);}finally{await rm(root,{recursive:true,force:true});}
});
test('failed or malformed helper output cleans source and refuses unsafe ZIP outputs',async()=>{
 const root=await mkdtemp(join(tmpdir(),'tacitus-author-test-')),digest=createHash('sha256').update(await readFile(process.execPath)).digest('hex');
 try{for(const mode of ['failure','oversize','digest']){const author=createAuthor({binary:process.execPath,digest,tempRoot:root,runner:async(_b,args)=>{if(mode==='failure')throw Error('refuse');await writeFile(args[1],Buffer.alloc(mode==='oversize'?1048577:4));return Buffer.from(JSON.stringify({archive_digest:'0'.repeat(64)}));}});await assert.rejects(author(payload()));assert.deepEqual(await readdir(root),[]);}}finally{await rm(root,{recursive:true,force:true});}
});
test('configured Rust helper authors/validates native ZIP and existing core inspects/queries/refuses',{skip:!process.env.TACITUS_CAPTURE_AUTHOR_BIN&&process.env.TACITUS_ACCEPTANCE!=='1'},async()=>{
 const binary=process.env.TACITUS_CAPTURE_AUTHOR_BIN,core=process.env.TACITUS_KNOWLEDGE_CAPTURE_BIN;
 if(process.env.TACITUS_ACCEPTANCE==='1'){assert.ok(binary,'full author acceptance requires helper');assert.ok(core);assert.equal(process.env.TACITUS_LOCAL_AUTHORING,'1');}
 if(!binary)return;const digest=process.env.TACITUS_CAPTURE_AUTHOR_SHA256;assert.match(digest??'',/^[a-f0-9]{64}$/);
 const root=await mkdtemp(join(tmpdir(),'tacitus-author-real-'));try{
  const p=payload(),result=await createAuthor({binary,digest,tempRoot:root})(p);assert.deepEqual(await readdir(root),[]);const file=join(root,'result.zip');await writeFile(file,result.archive);
  const inspect=spawnSync(core,['inspect',file],{env:{},encoding:'utf8'});assert.equal(inspect.status,0,inspect.stderr);assert.equal(JSON.parse(inspect.stdout).archive_digest,result.digest);
  const q={question:'Harbor Council',known_as_of:result.checkpoint,valid_at:result.checkpoint,time_mode:'disclose_unknown',max_bytes:65536,revoked_sources:[]};
  const query=x=>spawnSync(core,['reuse',file],{env:{},input:JSON.stringify(x),encoding:'utf8'});const a=query(q),b=query(q);assert.equal(a.status,0,a.stderr);assert.equal(a.stdout,b.stdout);const c=JSON.parse(a.stdout);assert.equal(Object.keys(c.context.claims).length,2);assert.equal(Object.keys(c.source_metadata).length,1);assert.match(c.status,/unreviewed/);assert.match(c.temporal_status['claim-a'],/UNKNOWN/);assert.equal(c.context.claims['claim-a'].citations[0].text,quotes[0]);
  for(const x of [{...q,time_mode:'require_declared_interval'},{...q,known_as_of:q.known_as_of-1},{...q,revoked_sources:['source-1@1']}]){const r=query(x);assert.notEqual(r.status,0);assert.equal(r.stdout,'');}
  const content=spawnSync('/usr/bin/python3',['-c',"import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);names=[n for n in z.namelist() if n.startswith('evidence/')];assert len(names)==1;sys.stdout.buffer.write(z.read(names[0]))",file]);assert.equal(content.status,0,content.stderr?.toString());assert.deepEqual(content.stdout,bytes);
  const tamper=payload();tamper.quotes[0]='not the source quote';const input=join(root,'bad.json'),output=join(root,'bad.zip');await writeFile(input,JSON.stringify(tamper));const rejected=spawnSync(binary,[input,output],{env:{},encoding:'utf8'});assert.notEqual(rejected.status,0);assert.equal(rejected.stdout,'');
 }finally{await rm(root,{recursive:true,force:true});}
});
