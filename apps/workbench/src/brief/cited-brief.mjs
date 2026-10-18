// Manual export only. No network, provider SDK, filesystem or clipboard access.
import policy from '../../../../tools/offline-eval/cited-prompt-policy.json' with {type:'json'};
import {makeLiveRun} from '../live-comparison.mjs';
import {encoder,strictJSON,ensure,fields,same,hash,canonical,object} from '../collection/strict-data.mjs';
export const PROMPT_MAX_BYTES=1048576,PACKAGE_MAX_BYTES=2097152;
const SOURCE_FIELDS=['id','version','workspace','document_id','title','author','original_hash','text_hash','text','language','extractor','published_at','retrieved_at','available_at','valid_from','valid_until','source_family','withdrawn','restricted','redistributable','license'];
const ASSERTION_FIELDS=['id','version','workspace','speaker','subject','predicate','object','proposition','epistemic_type','modality','conditions','exceptions','evidence','created_at'];
const SPAN_FIELDS=['source','text_hash','start','end','locator','original_language','translation'];
const digest=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
function selectedIndex(input){
 fields(input,['archive','core','query','raw','origin'],'brief input');ensure(typeof input.raw==='string'&&encoder.encode(input.raw).length<=250000,'Brief needs one bounded exact native Context');
 fields(input.query,['question','known_as_of','valid_at','time_mode','max_bytes','revoked_sources'],'brief request');ensure(input.query.revoked_sources.length===0,'Revoked request cannot prepare a brief');
 const context=strictJSON(encoder.encode(input.raw));makeLiveRun(input);
 fields(context,['format','archive_digest','status','selection','manifest','context','temporal_status','source_metadata','observed_at'],'native Context');const packet=context.context;
 fields(packet,['format','ontology','trust','question','workspace','known_as_of','valid_at','claims','entities','relationships','omissions','warnings'],'selected context');
 ensure(context.status==='unreviewed_evidence_context'&&Object.keys(packet.claims).length>0,'No selected evidence: omission-only/refused Context cannot prepare a brief');
 const claimIDs=Object.keys(packet.claims).sort(),sourceIDs=new Set(),index=[];
 ensure(object(packet.entities)&&Array.isArray(packet.relationships)&&!Object.keys(packet.omissions).some(id=>Object.hasOwn(packet.claims,id)),'Invalid selected graph/omissions');
 ensure(same(Object.keys(context.observed_at).sort(),claimIDs)&&same(Object.keys(context.temporal_status).sort(),claimIDs),'Unselected temporal metadata');
 for(const id of claimIDs){const layer=packet.claims[id];fields(layer,['assertion','knowledge','citations'],'selected claim');const a=layer.assertion;fields(a,ASSERTION_FIELDS,'assertion');ensure(a.id===id&&Array.isArray(a.evidence)&&a.evidence.length>0&&a.evidence.length===layer.citations.length,'Missing exact citations');
  for(let n=0;n<layer.citations.length;n++){const citation=layer.citations[n];fields(citation,['span','text','title','family','license'],'citation');const span=citation.span;fields(span,SPAN_FIELDS,'citation span');ensure(same(span,a.evidence[n]),'Citation does not match selected assertion');const source=context.source_metadata[span.source];ensure(source,'Citation source missing');sourceIDs.add(span.source);
   fields(source,SOURCE_FIELDS,'selected source metadata');ensure(source.text===''&&source.withdrawn===false&&source.restricted===false&&source.redistributable===true,'Withdrawn/restricted/nonredistributable or full-source metadata refused');ensure(citation.title===source.title&&citation.family===source.source_family&&citation.license===source.license,'Citation attribution mismatch');
   index.push({claim_id:id,source:span.source,text_hash:span.text_hash,start:span.start,end:span.end,quote:citation.text,locator:span.locator,original_language:span.original_language,translation:span.translation,title:citation.title,source_author:source.author,license:citation.license});
  }
 }
 ensure(same([...sourceIDs].sort(),Object.keys(context.source_metadata).sort()),'Unselected source metadata refused');
 for(const node of Object.values(packet.entities))ensure(Array.isArray(node.claims)&&node.claims.every(id=>claimIDs.includes(id)),'Unselected entity claims refused');
 for(const link of packet.relationships)ensure(claimIDs.includes(link.from)&&claimIDs.includes(link.to),'Unselected relationship refused');
 const origin=input.origin;
 if(origin.kind==='live-native-context'){fields(origin,['kind'],'live origin');}
 else {fields(origin,['kind','manifest_sha256','snapshot_sha256','query_receipt_sha256'],'saved packet origin');ensure(origin.kind==='saved-collection-native-context'&&[origin.manifest_sha256,origin.snapshot_sha256,origin.query_receipt_sha256].every(digest),'Unbound collection origin');}
 return {context,index};
}
function base64(raw){let text='';for(let i=0;i<raw.length;i+=32768)text+=String.fromCharCode(...raw.subarray(i,i+32768));return btoa(text);}
export async function prepareCitedBrief(input){
 const {context,index}=selectedIndex(input),raw=encoder.encode(input.raw),contextHash=await hash(raw),contractHash=await hash(canonical(policy));
 const binding={origin:input.origin,archive_sha256:input.archive,core_sha256:input.core,request:input.query,context_sha256:contextHash,context_bytes:raw.length,selected_assertions:Object.keys(context.context.claims).length,omitted_assertions:Object.keys(context.context.omissions).length,revocation_freshness:'Snapshot only; no external current revocation authority checked.'};
 const data=JSON.stringify({binding,citation_index:index})+'\n',question=JSON.stringify(input.query.question);let counter=0,marker;
 do {marker='TACITUS_DATA_'+contextHash+'_'+counter++;}while((data+input.raw+question).includes(marker));
 const instructions=[policy.before_citation,policy.citation_request+policy.manual_citation_suffix,policy.after_citation].join(' ');
 const prompt=instructions+'\n\n'+policy.task_heading+'\n'+policy.manual_task+'\n\n'+policy.question_heading+' (JSON string)\n'+question+'\n\n'+policy.evidence_heading+'\nBEGIN_'+marker+'\n'+data+'EXACT CONTEXT JSON ('+raw.length+' UTF-8 bytes; SHA-256 '+contextHash+')\n'+input.raw+'\nEND_'+marker+'\n\n'+policy.manual_suffix+'\n';
 const promptBytes=encoder.encode(prompt);ensure(promptBytes.length<=PROMPT_MAX_BYTES,'Complete prompt exceeds 1 MiB; no evidence was truncated');
 const artifact={format:'tacitus-cited-brief-prompt/1',policy_sha256:contractHash,binding,context_base64:base64(raw),citation_index:index,prompt_bytes:promptBytes.length,prompt_sha256:await hash(promptBytes),prompt};
 const packageBytes=encoder.encode(JSON.stringify(artifact,null,2)+'\n');ensure(packageBytes.length<=PACKAGE_MAX_BYTES,'Complete prompt package exceeds 2 MiB; no evidence was truncated');
 return {artifact,packageBytes,promptBytes};
}
export async function verifyCitedBrief(bytes,input){
 ensure(bytes.length<=PACKAGE_MAX_BYTES,'Prompt package exceeds 2 MiB');const expected=await prepareCitedBrief(input);
 ensure(bytes.length===expected.packageBytes.length&&bytes.every((b,i)=>b===expected.packageBytes[i]),'Prompt package differs from the current exact Context, request, scope or policy; regenerate it');return expected;
}
