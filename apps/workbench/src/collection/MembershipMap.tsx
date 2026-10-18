import {useEffect,useRef} from 'react';
import type {CollectionModel,CollectionSource} from './types';
/** Containment only. No inferred semantic edges, force simulation or animation. */
export default function MembershipMap({model,sources,onSelect}:{model:CollectionModel;sources:CollectionSource[];onSelect:(source:CollectionSource)=>void}){
 const height=Math.max(420,145+Math.ceil((model.capsules.length+(model.manifest.source_only_ids.length?1:0))/8)*28+Math.ceil(sources.length/32)*21);
 const ref=useRef<HTMLCanvasElement>(null),points=useRef<{source:CollectionSource;x:number;y:number}[]>([]);
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;const start=performance.now(),width=1000,dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#101e2a';ctx.fillRect(0,0,width,height);
  const groups=[...model.capsules.map((c,i)=>({id:c.id,label:`Capsule ${i+1}`})),...(model.manifest.source_only_ids.length?[{id:null,label:'Source-only'}]:[])];const positions=new Map(groups.map((g,i)=>[g.id,{x:50+(i%8)*125,y:55+Math.floor(i/8)*28}]));
  ctx.font='12px system-ui';for(const g of groups){const p=positions.get(g.id)!;ctx.fillStyle=g.id?'#e6ba78':'#9eb2c7';ctx.fillRect(p.x-6,p.y-8,12,12);ctx.fillText(g.label,p.x+9,p.y+2);}
  const nodeTop=95+Math.ceil(groups.length/8)*28;points.current=sources.map((source,i)=>({source,x:35+(i%32)*30,y:nodeTop+Math.floor(i/32)*21}));
  ctx.strokeStyle='#345364';ctx.lineWidth=.65;for(const p of points.current){if(p.source.capsule){const parent=positions.get(p.source.capsule)!;ctx.beginPath();ctx.moveTo(parent.x,parent.y+6);ctx.lineTo(p.x,p.y);ctx.stroke();}}
  for(const p of points.current){ctx.beginPath();ctx.fillStyle=p.source.capsule?'#75b8ef':'#9eb2c7';ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();}
  canvas.dataset.drawMs=(performance.now()-start).toFixed(2);canvas.dataset.sourceCount=String(sources.length);
 },[model,sources,height]);
 return <figure className="membership-map"><figcaption>Declared membership: {sources.length} visible raw sources and {model.capsules.length} native capsules. Lines show source containment only; source-only records have no native edge. Use the keyboard-accessible source list below for the same selection.</figcaption><canvas ref={ref} style={{aspectRatio:`1000 / ${height}`}} role="img" aria-label={`Source membership map: ${sources.length} visible sources; declared containment only`} onClick={event=>{const canvas=ref.current;if(!canvas)return;const bounds=canvas.getBoundingClientRect(),x=(event.clientX-bounds.left)*1000/bounds.width,y=(event.clientY-bounds.top)*height/bounds.height;const found=points.current.find(p=>(p.x-x)**2+(p.y-y)**2<100);if(found)onSelect(found.source);}}/></figure>;
}
