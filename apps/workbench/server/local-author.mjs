import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,readFile,lstat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,isAbsolute} from 'node:path';
import {InspectorError,runCore} from './local-inspector.mjs';
export const AUTHOR_LIMITS=Object.freeze({body:262144,source:32768,archive:1048576,timeout:10000});
const fail=code=>{throw new InspectorError(code,400);};
const text=(v,max=2000)=>typeof v==='string'&&!!v.trim()&&Buffer.byteLength(v)<=max;
export function validateAuthor(input,now=Math.floor(Date.now()/1000)){
 const c=input?.capture,d=c?.documents?.[0],a=c?.assertions,g=c?.graph,m=c?.manifest,t=m?.created_at;
 if(!c||!Array.isArray(c.documents)||c.documents.length!==1||!Array.isArray(a)||a.length!==2||!Array.isArray(input.quotes)||input.quotes.length!==2||
  !text(d?.text,AUTHOR_LIMITS.source)||Buffer.from(d.text,'utf8').toString('utf8')!==d.text||d.text.includes('\0'))fail('invalid_source_text');
 if(!Number.isSafeInteger(t)||Math.abs(now-t)>300||!c.confirms_rights||!text(m.author,200)||!text(d.author,200)||!text(d.title,200)||!text(d.document_id,1000)||!text(d.license,2000)||m.license!==d.license||
  m.schema_version!==2||m.confidentiality!=='private'||m.evidence_mode!=='evidence_included'||!Array.isArray(m.dependencies)||m.dependencies.length||!m.files||Object.keys(m.files).length||m.valid_until!==null||
  d.id!=='source-1'||d.version!==1||d.workspace!==m.scope||d.available_at!==t||d.retrieved_at!==t||d.published_at!==null||d.valid_from!==null||d.valid_until!==null||d.restricted!==false||d.withdrawn!==false||d.redistributable!==true)fail('invalid_author_declaration');
 const hash=createHash('sha256').update(d.text,'utf8').digest('hex');if(d.text_hash!==hash||d.original_hash!==hash)fail('source_hash_mismatch');
 if(!g||!g.nodes||Object.keys(g.nodes).length!==1||!Array.isArray(g.links)||g.links.length!==1||!g.knowledge||Object.keys(g.knowledge).length||!g.claim_fingerprints||Object.keys(g.claim_fingerprints).length)fail('explicit_graph_required');
 const node=Object.values(g.nodes)[0],link=g.links[0];
 if(!['actor','institution','event'].includes(node.kind)||!text(node.label,200)||!Array.isArray(node.claims)||node.claims.length!==2||!['claim-a','claim-b'].every(id=>node.claims.includes(id))||node.event_time!==null||
  !['contradicts','supersedes','depends_on'].includes(link.kind)||!['claim-a','claim-b'].includes(link.from)||!['claim-a','claim-b'].includes(link.to)||link.from===link.to||!text(link.rationale,2000)||g.available_at!==t)fail('explicit_graph_required');
 if(!c.observed_at||Object.keys(c.observed_at).length!==2)fail('unknown_observations_required');
 for(let i=0;i<2;i++){
  const v=a[i],quote=input.quotes[i],span=v?.evidence?.[0];
  if(v?.id!==['claim-a','claim-b'][i]||v.workspace!==m.scope||v.created_at!==t||!text(v.proposition,4000)||!text(v.speaker,200)||!text(v.modality,1000)||v.subject!==node.label||v.predicate!=='states'||v.epistemic_type!=='reported_statement'||
   !Object.hasOwn(c.observed_at,v.id)||c.observed_at[v.id]!==null||!Array.isArray(v.evidence)||v.evidence.length!==1||![v.conditions,v.exceptions].every(l=>Array.isArray(l)&&l.length<=12&&l.every(s=>text(s,2000)))||!v.conditions.includes('Unreviewed user-authored proposal; not independently established truth.'))fail('invalid_user_annotation');
  if(!text(quote,AUTHOR_LIMITS.source)||/[\r\n]/.test(quote)||d.text.indexOf(quote)<0||d.text.indexOf(quote,d.text.indexOf(quote)+1)!==-1)fail('quote_missing_or_ambiguous');
  const start=Buffer.byteLength(d.text.slice(0,d.text.indexOf(quote)));if(!span||span.source!=='source-1@1'||span.text_hash!==hash||span.start!==start||span.end!==start+Buffer.byteLength(quote))fail('quote_span_mismatch');
 }
 return input;
}
export function createAuthor({binary,digest,tempRoot=tmpdir(),runner=runCore}){
 let active=false;
 return async(input,signal,deadline=Date.now()+AUTHOR_LIMITS.timeout)=>{
  if(!binary||!isAbsolute(binary)||!/^[a-f0-9]{64}$/.test(digest??''))throw new InspectorError('author_not_configured',503);
  if(active)throw new InspectorError('inspector_busy',429);active=true;let dir;
  const remaining=()=>{if(signal?.aborted)throw new InspectorError('cancelled',499);const ms=deadline-Date.now();if(ms<=0)throw new InspectorError('author_timeout',504);return ms;};
  try{
   remaining();validateAuthor(input);if(createHash('sha256').update(await readFile(binary)).digest('hex')!==digest)throw new InspectorError('author_digest_mismatch',503);
   remaining();dir=await mkdtemp(join(tempRoot,'tacitus-author-'));const source=join(dir,'capture.json'),output=join(dir,'capsule.zip');
   await writeFile(source,JSON.stringify(input),{flag:'wx',mode:0o600});
   const receipt=JSON.parse((await runner(binary,[source,output],'',{signal,timeout:remaining(),output:65536})).toString('utf8'));remaining();
   const stat=await lstat(output);if(!stat.isFile()||stat.isSymbolicLink()||stat.size<4||stat.size>AUTHOR_LIMITS.archive)throw new InspectorError('author_output_limit',502);
   const archive=await readFile(output);remaining();const hash=createHash('sha256').update(archive).digest('hex');if(hash!==receipt.archive_digest)throw new InspectorError('author_archive_mismatch',502);
   return {archive,digest:hash,checkpoint:input.capture.manifest.created_at};
  }finally{try{if(dir)await rm(dir,{recursive:true,force:true});}finally{active=false;}}
 };
}
