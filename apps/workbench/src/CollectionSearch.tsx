import {useState} from 'react';

type Result={format:string;status:string;warnings:string[];source_metadata:Record<string,{title:string;url:string;rights_id:string;historical_availability_warning:string}>;excerpts:{revision:string;block_id:string;text:string;locator:string;start:number;end:number}[];receipt:{indexed_sources:number;visited_shards:number;included_blocks:number;omitted_blocks:number}};

export default function CollectionSearch(){
  const [question,setQuestion]=useState('relief assurance permission'),[raw,setRaw]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const result=raw?JSON.parse(raw) as Result:null;
  async function search(){
    setBusy(true);setRaw('');setError('');
    try{
      const response=await fetch('/api/collection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question})});
      const text=await response.text();if(!response.ok)throw new Error(JSON.parse(text).error);
      const value=JSON.parse(text);if(value.format!=='tacitus-local-source-context/1')throw new Error('Unsupported source context');setRaw(text);
    }catch(e){setError(String(e));}finally{setBusy(false);}
  }
  function download(){const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='lexical-source-context.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section id="collection-search" tabIndex={-1} aria-label="Expanded lexical collection"><h2>622-record lexical collection</h2>
    <p>Search exact source blocks across 32 index shards. This separate source index produces no native capsule, semantic graph, generated answer or reviewed claim. The native capsules contain bounded, assistant-authored unreviewed proposals. The ten method proposals are not retrieved by the core.</p>
    <p>This search uses the full modern collection without a historical cutoff. Dates, unknown validity, retrospective memoir evidence, source rights and omissions remain in the complete response. Read the collection's <a href="/notices/expanded-RIGHTS.md">source rights</a>.</p>
    <label>Lexical question<input value={question} disabled={busy} maxLength={2000} onChange={e=>{setQuestion(e.target.value);setRaw('');setError('');}}/></label>
    <button disabled={busy||!question.trim()} onClick={()=>void search()}>Search all 622 sources</button><p role="status">{busy?'Searching source blocks…':error}</p>
    {result&&<><p>{result.status}. {result.receipt.indexed_sources} sources; {result.receipt.visited_shards} shards visited; {result.receipt.included_blocks} included blocks; {result.receipt.omitted_blocks} omitted blocks. Full output is bounded to 32,768 UTF-8 bytes.</p>
      {result.warnings.map(w=><p key={w}>{w}</p>)}<button onClick={download}>Export exact lexical source JSON</button>
      {result.excerpts.map((e,i)=>{const source=result.source_metadata[e.revision];return <article key={`${e.block_id}-${i}`}><h3>{source.title}</h3><blockquote>{e.text}</blockquote><p>{e.locator} · UTF-8 bytes [{e.start}, {e.end}) · {source.rights_id}</p><p>{source.historical_availability_warning}</p></article>;})}
      <details><summary>Full unchanged lexical response, provenance and omissions</summary><pre>{raw}</pre></details></>}
  </section>;
}
