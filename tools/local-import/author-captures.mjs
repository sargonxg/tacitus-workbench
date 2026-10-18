// Reuse the single-source UI/server declarations; no inference or new native schema.
import {readFileSync} from 'node:fs';
import {readLocalText,buildLocalCapture} from '../../apps/workbench/src/local-author-client.mjs';
import {validateAuthor} from '../../apps/workbench/server/local-author.mjs';
const items=JSON.parse(readFileSync(0,'utf8'));
const out=[],errors=[];
for(const item of items){try{
 const source=await readLocalText(new File([item.text],'source.md'));
 const s=item.declaration,a=s.authoring;
 const form={...a,title:s.title,sourceAuthor:s.author,rights:s.rights,provenance:s.provenance,confirmsRights:s.confirms_rights};
 const p=buildLocalCapture(source,form,item.checkpoint);validateAuthor(p,item.checkpoint);
 const c=p.capture,d=c.documents[0],oldKey='source-1@1',key=`${item.id}@${item.version}`;
 d.id=item.id;d.version=item.version;d.language=s.language;
 const ids={'claim-a':`${item.id}-a`,'claim-b':`${item.id}-b`};
 for(const claim of c.assertions){claim.id=ids[claim.id];for(const span of claim.evidence){if(span.source!==oldKey)throw Error('unexpected source reference');span.source=key;span.original_language=s.language;}}
 c.observed_at=Object.fromEntries(Object.keys(c.observed_at).map(id=>[ids[id],null]));
 const node=c.graph.nodes.subject;node.id=`${item.id}-subject`;node.claims=node.claims.map(id=>ids[id]);c.graph.nodes={[node.id]:node};
 for(const link of c.graph.links){link.from=ids[link.from];link.to=ids[link.to];}
 out.push({id:item.id,capture:c,quotes:p.quotes});
}catch(error){errors.push({key:item.key,error:String(error)});}}
process.stdout.write(JSON.stringify(errors.length?{errors}:out));
