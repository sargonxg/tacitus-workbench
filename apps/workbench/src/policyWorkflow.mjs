export const MAX_POLICY_WORKFLOW_BYTES=2*1024*1024;
const ensure=(v,m)=>{if(!v)throw Error(m)};
const array=(v,n)=>Array.isArray(v)&&v.length<=n;
const text=(v,n=20000)=>typeof v==='string'&&v.length>0&&v.length<=n;
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
export async function inspectPolicyWorkflow(raw){
 ensure(typeof raw==='string'&&new TextEncoder().encode(raw).byteLength<=MAX_POLICY_WORKFLOW_BYTES,'Workflow exceeds the 2 MiB limit.');
 const v=JSON.parse(raw);ensure(v?.format==='tacitus-policy-workflow/1','Unsupported pipeline workflow format.');
 const c=v.capsule,a=v.artifact;ensure(c?.format==='tacitus-reference-context/1'&&text(c.question)&&array(c.statements,200)&&c.statements.length>0&&array(c.sources,100),'Missing bounded capsule records.');
 ensure(a?.review_state==='draft_for_human_review'&&array(a.items,12)&&a.items.length>0&&text(a.title,200)&&array(a.questions,12)&&array(a.limitations,12),'Only unapproved review drafts are supported.');
 ensure(a.checks?.semantic_entailment==='not_automatically_verified','Semantic verification boundary is missing.');
 const ids=new Map();for(const s of c.statements){ensure(text(s.id,160)&&!ids.has(s.id)&&text(s.quote)&&text(s.interpretation)&&s.review_state==='proposed'&&array(s.qualifiers,50),'Invalid or duplicate statement.');for(const q of s.qualifiers){ensure(Number.isSafeInteger(q.start)&&Number.isSafeInteger(q.end)&&q.start>=0&&q.end>q.start&&Array.from(s.quote).slice(q.start,q.end).join('')===q.text,'Qualification span does not resolve.');}ids.set(s.id,s);}
 const versions=new Map();for(const s of c.sources){ensure(text(s.title,1000)&&text(s.scope)&&/^[a-f0-9]{64}$/.test(s.version)&&array(s.aliases,200),'Invalid source metadata.');let u;try{u=new URL(s.url)}catch{throw Error('Invalid source URL.')}ensure(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password,'Unsafe source URL.');for(const id of s.aliases)versions.set(id,s.version);}
 for(const s of c.statements)ensure(versions.get(s.source_id)===s.source_version,'Statement source version does not resolve.');
 for(const item of a.items){ensure(text(item.text,2000)&&array(item.evidence_ids,8)&&item.evidence_ids.length>0&&new Set(item.evidence_ids).size===item.evidence_ids.length&&array(item.evidence,8)&&item.evidence.length===item.evidence_ids.length&&array(item.review_flags,100)&&item.review_flags.every(x=>text(x)),'Invalid cited draft item.');for(let i=0;i<item.evidence_ids.length;i++)ensure(ids.has(item.evidence_ids[i])&&canonical(ids.get(item.evidence_ids[i]))===canonical(item.evidence[i]),'Draft evidence differs from the capsule.');}
 ensure(a.questions.every(s=>text(s,1200))&&a.limitations.every(s=>text(s,1200)),'Invalid questions or limitations.');
 ensure(v.run&&/^[a-f0-9]{64}$/.test(v.run.context_sha256)&&Number.isSafeInteger(v.run.model_calls)&&v.run.model_calls>=1&&v.run.model_calls<=4&&text(v.run.provider,100)&&text(v.run.model_requested,200),'Missing model receipt.');
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(c))));const hash=Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join('');ensure(hash===v.run.context_sha256,'Capsule checksum mismatch.');
 ensure(v.graph&&array(v.graph.nodes,1000)&&array(v.graph.edges,3000),'Missing bounded graph.');const graphIds=new Set();for(const n of v.graph.nodes){ensure(text(n.id,200)&&text(n.kind,100)&&!graphIds.has(n.id),'Invalid graph node.');graphIds.add(n.id);}for(const e of v.graph.edges)ensure(graphIds.has(e.source)&&graphIds.has(e.target)&&text(e.relation,100),'Graph endpoint missing.');
 return {value:v,raw};
}
