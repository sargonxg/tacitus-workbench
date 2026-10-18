// Two in-memory live receipts. Original Context strings are never reserialized.
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
/** @param {{archive:string,core:string|null,query:any,raw?:string|null,error?:string|null}} input */
export function makeLiveRun({archive,core,query,raw=null,error=null}) {
  if (!hash(archive)||!hash(core)) throw new Error('Verified archive/core identity required');
  const request=JSON.parse(JSON.stringify(query));
  if(typeof request.question!=='string'||!request.question.trim()||new TextEncoder().encode(request.question).length>8000||![request.known_as_of,request.valid_at].every(Number.isSafeInteger)||
    !Number.isSafeInteger(request.max_bytes)||request.max_bytes<2048||request.max_bytes>250000||
    !['disclose_unknown','require_declared_interval'].includes(request.time_mode)||!Array.isArray(request.revoked_sources)||request.revoked_sources.length>100||!request.revoked_sources.every(v=>typeof v==='string'&&v.length<=256)) throw new Error('Invalid run request');
  let context=null;
  if(raw!==null){
    if(typeof raw!=='string'||new TextEncoder().encode(raw).length>request.max_bytes)throw new Error('Context exceeds requested budget');
    context=JSON.parse(raw);
    if(context.format!=='tacitus-uploaded-knowledge-context/1'||context.context?.format!=='tacitus-layered-policy-context/1'||
      context.archive_digest!==archive||context.context.question!==request.question||context.context.known_as_of!==request.known_as_of||
      context.context.valid_at!==request.valid_at||!context.context.claims||!context.source_metadata||!context.temporal_status||!context.observed_at||error!==null) throw new Error('Context does not match request');
    if(Array.isArray(context.context.claims)||Array.isArray(context.source_metadata))throw new Error('Invalid Context maps');
    if(typeof context.status!=='string'||!context.context.omissions||!Array.isArray(context.context.warnings)||!context.context.warnings.every(v=>typeof v==='string')||!Object.values(context.context.omissions).every(v=>typeof v==='string'))throw new Error('Invalid omission disclosure');
    for(const [key,s] of Object.entries(context.source_metadata)){
      if(!s||key!==`${s.id}@${s.version}`||![s.id,s.title,s.license].every(v=>typeof v==='string')||!hash(s.text_hash)||!Number.isSafeInteger(s.version)||
        ![s.published_at,s.available_at,s.valid_from,s.valid_until].every(v=>v==null||Number.isSafeInteger(v))||!(s.document_id==null||typeof s.document_id==='string'))throw new Error('Invalid source metadata');
    }
    for(const [id,layer] of Object.entries(context.context.claims)){
      const a=layer.assertion;
      if(!a||a.id!==id||![a.proposition,a.speaker,a.modality,a.epistemic_type,layer.knowledge].every(v=>typeof v==='string')||
        ![a.conditions,a.exceptions].every(v=>Array.isArray(v)&&v.every(x=>typeof x==='string'))||!Array.isArray(layer.citations)||
        typeof context.temporal_status[id]!=='string'||!Object.hasOwn(context.observed_at,id)||!(context.observed_at[id]===null||Number.isSafeInteger(context.observed_at[id])))throw new Error('Invalid claim projection');
      for(const c of layer.citations){const s=c.span;const meta=s&&Object.hasOwn(context.source_metadata,s.source)?context.source_metadata[s.source]:null;
        if(!s||!meta||s.source!==`${meta.id}@${meta.version}`||!hash(s.text_hash)||meta.text_hash!==s.text_hash||
          ![c.text,c.title,c.license].every(v=>typeof v==='string')||!(s.locator==null||typeof s.locator==='string')||
          !Number.isSafeInteger(s.start)||!Number.isSafeInteger(s.end)||s.start<0||s.end<=s.start||s.end-s.start!==new TextEncoder().encode(c.text).length)throw new Error('Invalid source-linked citation');
      }
    }
  } else if(typeof error!=='string'||!/^[a-z_]{1,80}$/.test(error)) throw new Error('Explicit core refusal required');
  return {archive,core,query:request,raw,error,context};
}
export function compareLiveRuns(left,right) {
  if(left.archive!==right.archive)throw new Error('Archive mismatch: reimport clears saved runs');
  if(left.core!==right.core)throw new Error('Core digest mismatch: runs used different executables');
  for(const field of ['question','max_bytes','time_mode','revoked_sources'])if(!same(left.query[field],right.query[field]))throw new Error(`Unmatched ${field}: only native checkpoints may differ`);
  if(!left.context||!right.context)return {refused:true,claims:[],sources:[],message:'A core query was refused. No evidence-set difference is inferred from missing Context.'};
  if(left.context.archive_digest!==right.context.archive_digest)throw new Error('Returned archive identity mismatch');
  const claims=[...new Set([...Object.keys(left.context.context.claims),...Object.keys(right.context.context.claims)])].sort().map(id=>{
    const a=Object.hasOwn(left.context.context.claims,id)?left.context.context.claims[id]:undefined,b=Object.hasOwn(right.context.context.claims,id)?right.context.context.claims[id]:undefined;
    const status=!a?'selected only in B':!b?'selected only in A':!same(a,b)?'claim or citation content differs':!same([left.context.temporal_status[id],left.context.observed_at[id]],[right.context.temporal_status[id],right.context.observed_at[id]])?'temporal disclosure differs':'same selected claim and temporal disclosure';
    return {id,status};
  });
  const selected=run=>new Set(Object.values(run.context.context.claims).flatMap(layer=>layer.citations.map(c=>c.span.source)));
  const a=selected(left),b=selected(right);
  const sources=[...new Set([...a,...b])].sort().map(id=>({id,status:!a.has(id)?'selected only in B':!b.has(id)?'selected only in A':'cited in both'}));
  return {refused:false,claims,sources,message:'Selection differences describe these bounded core outputs. They do not establish changed truth, semantic relevance or what an actor knew.'};
}
