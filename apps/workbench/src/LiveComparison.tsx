import {compareLiveRuns} from './live-comparison.mjs';
import {safeSourceUrl} from './graph/evidenceGraph';
import type {NativeContext} from './graph/evidenceGraph';
export type LiveRun={archive:string;core:string;query:{question:string;known_as_of:number;valid_at:number;time_mode:string;max_bytes:number;revoked_sources:string[]};raw:string|null;error:string|null;context:NativeContext|null};
function SourceFacts({run,id}:{run:LiveRun;id:string}){
  const metadata=run.context?.source_metadata;const s=metadata&&Object.hasOwn(metadata,id)?metadata[id]:undefined;
  if(!s)return <p>Not supplied in this Context.</p>;
  return <div><p>{s.title}; version {s.version}; hash {s.text_hash}.</p><p>Published at: {s.published_at??'Unknown'}; available at (ingestion): {s.available_at??'Unknown'}; validity from {s.valid_from??'Unknown'} to {s.valid_until??'Unknown'}.</p><p>{s.license}</p>{safeSourceUrl(s.document_id)&&<a href={safeSourceUrl(s.document_id)} target="_blank" rel="noopener noreferrer">Open original source</a>}</div>;
}
function Evidence({run,id}:{run:LiveRun;id:string}){
  const claims=run.context?.context.claims;const layer=claims&&Object.hasOwn(claims,id)?claims[id]:undefined;
  if(!layer)return <p>Not selected in this run. Omission: {(run.context?.context.omissions&&Object.hasOwn(run.context.context.omissions,id)?run.context.context.omissions[id]:'No reason supplied; do not infer irrelevance.')}</p>;
  const a=layer.assertion;
  return <div><p>{a.proposition}</p><p>Speaker: {a.speaker}; modality: {a.modality}; epistemic type: {a.epistemic_type}; knowledge: {layer.knowledge}. Temporal status: {run.context?.temporal_status[id]??'Unknown / not supplied'}. Observed at: {run.context?.observed_at[id]??'Unknown'}.</p>
    <p>Conditions: {a.conditions.length?a.conditions.join(' · '):'None declared'}</p><p>Exceptions: {a.exceptions.length?a.exceptions.join(' · '):'None declared'}</p>
    {layer.citations.map((c,i)=><article key={i}><strong>{c.title}</strong><blockquote>{c.text}</blockquote><p>Source {c.span.source}; UTF-8 bytes [{c.span.start}, {c.span.end}); hash {c.span.text_hash}.</p><p>{c.span.locator??'Locator not supplied'}</p>{safeSourceUrl(c.span.locator?.split(';')[0])&&<a href={safeSourceUrl(c.span.locator?.split(';')[0])} target="_blank" rel="noopener noreferrer">Open cited source</a>}<p>{c.license}</p></article>)}
  </div>;
}
export default function LiveComparison({current,baseline,busy,onSave,onClear,onExportA}:{current:LiveRun|null;baseline:LiveRun|null;busy:boolean;onSave:()=>void;onClear:()=>void;onExportA:()=>void}){
  let result:any=null,error='';
  if(baseline&&current)try{result=compareLiveRuns(baseline,current);}catch(e){error=e instanceof Error?e.message:String(e);}
  return <section className="comparison" aria-label="Live checkpoint comparison"><h2>Compare modern retrieval checkpoints</h2>
    <p>Save run A, change only native checkpoints, then run the same query for B. Two runs stay in memory; reset, reimport or mode change clears them. These are modern ingestion/world-validity requests, not a reconstruction of what a diplomat knew in 1914. Unknown dates remain unknown. All returned claims are compared, including retrospective material hidden by the graph’s default perspective filter.</p>
    <button disabled={busy||!current?.context} onClick={onSave}>Save current live run as A</button><button disabled={busy||!baseline} onClick={onClear}>Clear saved run A</button><button disabled={busy||!baseline?.raw} onClick={onExportA}>Export saved run A exact Context JSON</button>
    <p>{baseline?'Run A saved.':'No run A saved.'} {current?.error?`Run B refused: ${current.error}. No Context returned.`:current?'Current live Context available.':'Run a live query for a current receipt.'}</p>
    {baseline&&<details><summary>Run A request and core identity</summary><p>Executable identity is a pre-invocation hash check of a trusted local file, not immutable execution attestation.</p><pre>{JSON.stringify({archive:baseline.archive,core:baseline.core,...baseline.query},null,2)}</pre></details>}
    {current&&<details><summary>Run B request and core identity</summary><pre>{JSON.stringify({archive:current.archive,core:current.core,...current.query},null,2)}</pre></details>}
    {error&&<p role="alert">Comparison unavailable: {error}</p>}
    {result&&<><p>Compared output bytes: A {new TextEncoder().encode(baseline!.raw??'').length}; B {current!.raw===null?'No Context':new TextEncoder().encode(current!.raw).length}. {baseline!.query.known_as_of!==current!.query.known_as_of&&baseline!.query.valid_at!==current!.query.valid_at?'Both clocks changed; do not attribute a difference to one clock.':'A/B labels describe capture order, not historical order.'}</p><p role="status">{result.message}</p>{!result.refused&&<><p>Context status: A {baseline!.context!.status}; B {current!.context!.status}. Selected counts cover the full Context, not the graph’s visible subset.</p><h3>Selected sources</h3><ul>{result.sources.map((s:{id:string;status:string})=><li key={s.id}><details><summary>{s.id}: {s.status}</summary><h4>Run A source</h4><SourceFacts run={baseline!} id={s.id}/><h4>Run B source</h4><SourceFacts run={current!} id={s.id}/></details></li>)}</ul><h3>Selected claims and exact evidence</h3>{result.claims.length===0&&<p>Neither run selected claims. An omission-only Context is not an answer.</p>}{result.claims.map((c:{id:string;status:string})=><details key={c.id}><summary>{c.id}: {c.status}</summary><h4>Run A</h4><Evidence run={baseline!} id={c.id}/><h4>Run B</h4><Evidence run={current!} id={c.id}/></details>)}</>}
      <p>Unchanged selection does not mean no historical change or complete evidence. This comparison does not verify complete source files or approve authored assertions.</p></>}
      {result&&<details><summary>Exact omission disclosures from both runs</summary><pre>{JSON.stringify({A:baseline?.context?.context.omissions??null,B:current?.context?.context.omissions??null},null,2)}</pre></details>}
  </section>;
}
