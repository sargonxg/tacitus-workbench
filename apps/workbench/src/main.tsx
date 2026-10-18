import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Explorer from './graph/EvidenceGraphExplorer';
import {graphFromContext} from './graph/evidenceGraph';
import type {NativeContext} from './graph/evidenceGraph';
import {createRequestEpoch,wholeContextBlob} from './local-inspector-client.mjs';
import './style.css';
import CollectionSearch from './CollectionSearch';
import LiveComparison from './LiveComparison';
import type {LiveRun} from './LiveComparison';
import {makeLiveRun} from './live-comparison.mjs';
import ProductGuide from './ProductGuide';
import LocalAuthor from './LocalAuthor';
import type {WalkthroughData} from './graph/julyWalkthroughModel';
const GuidedWalkthrough=lazy(()=>import('./graph/July1914Walkthrough'));

function App(){
  const [authoring,setAuthoring]=useState(false);
  const [mode,setMode]=useState<'live'|'recorded'>('live'),[available,setAvailable]=useState(false);
  const [archive,setArchive]=useState(''),[fileName,setFileName]=useState(''),[inspected,setInspected]=useState(false);
  const [raw,setRaw]=useState(''),[inspection,setInspection]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [question,setQuestion]=useState('peace'),[known,setKnown]=useState('1792328100'),[valid,setValid]=useState('1792328100'),[budget,setBudget]=useState('65536'),[timeMode,setTimeMode]=useState('disclose_unknown');
  const epoch=useRef(createRequestEpoch());
  const [currentRun,setCurrentRun]=useState<LiveRun|null>(null),[baseline,setBaseline]=useState<LiveRun|null>(null);
  const [archiveHash,setArchiveHash]=useState('');
  const fileInput=useRef<HTMLInputElement>(null);
  function editQuery(change:()=>void){epoch.current.cancel();setBusy(false);setRaw('');setCurrentRun(null);setMessage('Query changed; run the core again for these parameters.');change();}
  const [guided,setGuided]=useState<WalkthroughData|null>(null);
  async function loadGuided(){try{const response=await fetch('/examples/july1914-walkthrough.json');if(!response.ok)throw new Error('Guided fixture unavailable');setGuided(await response.json());}catch(e){setMessage(String(e));}}
  useEffect(()=>{fetch('/api/status').then(r=>r.json()).then(s=>{setAvailable(s.live===true);setAuthoring(s.authoring===true);}).catch(()=>setMessage('Local status unavailable.'));return()=>epoch.current.cancel();},[]);
  const projection=useMemo(()=>{if(!raw)return null;try{
    const context=JSON.parse(raw) as NativeContext;
    const presentation=Object.fromEntries(Object.entries(context.source_metadata).map(([id,s])=>[id,{perspective:s.source_family==='lichnowsky-gutenberg-39457-english'?'retrospective' as const:s.source_family==='frus1914Supp-official-1928'?'contemporary' as const:'unknown' as const}]));
    return {graph:graphFromContext(context,presentation),context,july:Object.values(context.source_metadata).some(s=>s.source_family==='frus1914Supp-official-1928')};
  }catch{return null;}},[raw]);
  function reset(clearFile=true){setCurrentRun(null);setBaseline(null);setArchiveHash('');epoch.current.cancel();setBusy(false);setArchive('');setFileName('');setInspected(false);setInspection('');setRaw('');setMessage('');if(clearFile&&fileInput.current)fileInput.current.value='';}
  async function choose(file?:File){reset(false);if(!file)return;const job=epoch.current.begin();try{if(file.size>8*1024*1024)throw new Error('ZIP exceeds the 8 MiB limit.');const bytes=new Uint8Array(await file.arrayBuffer());const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');let encoded='';for(let i=0;i<bytes.length;i+=32768)encoded+=String.fromCharCode(...bytes.subarray(i,i+32768));if(epoch.current.current(job.id)){setArchive(btoa(encoded));setArchiveHash(digest);setFileName(file.name);}}catch(e){if(epoch.current.current(job.id))setMessage(String(e));}}
  async function request(operation:'inspect'|'reuse'){
    const query={question,known_as_of:Number(known),valid_at:Number(valid),time_mode:timeMode,max_bytes:Number(budget),revoked_sources:[]};
    const requestArchive=archiveHash;
    const job=epoch.current.begin();setBusy(true);setMessage('');if(operation==='reuse'){setRaw('');setCurrentRun(null);}
    try{const response=await fetch('/api/inspect',{method:'POST',headers:{'Content-Type':'application/json'},signal:job.signal,body:JSON.stringify({operation,archive,query:operation==='reuse'?query:undefined})});
      const text=await response.text();if(!epoch.current.current(job.id))return;
      const core=response.headers.get('X-Tacitus-Core-SHA256');
      if(!response.ok){const code=JSON.parse(text).error??`HTTP ${response.status}`;
        if(operation==='reuse'&&response.status===422&&core)setCurrentRun(makeLiveRun({archive:requestArchive,core,query,error:code}) as LiveRun);
        throw new Error(code);
      }
      if(operation==='inspect'){setInspection(text);setInspected(true);}else{
        setRaw(text);
        try{setCurrentRun(makeLiveRun({archive:requestArchive,core,query,raw:text}) as LiveRun);}
        catch(e){setMessage(`Context retained unchanged; comparison unavailable: ${String(e)}`);}
      }
    }catch(e){if(epoch.current.current(job.id))setMessage(`Live operation failed: ${String(e)}. No recorded result was substituted.`);}finally{if(epoch.current.current(job.id))setBusy(false);}
  }
  async function recorded(){const job=epoch.current.begin();setBusy(true);setMessage('');try{const response=await fetch('/examples/peace.context.json',{signal:job.signal});if(!response.ok)throw new Error('Recorded example unavailable');const text=await response.text();wholeContextBlob(text);if(epoch.current.current(job.id))setRaw(text);}catch(e){if(epoch.current.current(job.id))setMessage(String(e));}finally{if(epoch.current.current(job.id))setBusy(false);}}
  function downloadContext(text:string,name:string){const url=URL.createObjectURL(wholeContextBlob(text));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function exportContext(){downloadContext(raw,mode==='recorded'?'recorded-peace.context.json':'live.context.json');}
  return <main><header><p className="eyebrow">Local research tools · policy and diplomacy</p><h1>TACITUS Workbench</h1><p>Reusable evidence-linked context for policy and diplomacy.</p></header>
    <ProductGuide live={available} onRecorded={()=>{reset();setMode('recorded');void recorded();document.getElementById('execution')?.focus();}} onLive={()=>{reset();setMode('live');document.getElementById('execution')?.focus();}}/>
    <LocalAuthor enabled={authoring} onInvalidate={()=>reset()} onUse={(file,checkpoint,question)=>{setMode('live');setKnown(String(checkpoint));setValid(String(checkpoint));setTimeMode('disclose_unknown');setQuestion(question);void choose(file);document.getElementById('execution')?.focus();}}/>
    <section id="execution" tabIndex={-1} className="controls" aria-label="Execution"><label>Execution mode<select value={mode} onChange={e=>{reset();setMode(e.target.value as 'live'|'recorded');}}><option value="live">Live local core</option><option value="recorded">Recorded July 1914 example</option></select></label>
    {mode==='live'?<><p>{available?'Local core configured. The executable digest is checked for each operation.':'Live execution is unavailable. Configure the pinned local executable and explicit opt-in, or select recorded example mode.'}</p><label>Native ZIP (maximum 8 MiB)<input ref={fileInput} type="file" accept=".zip" disabled={!available||busy} onChange={e=>void choose(e.target.files?.[0])}/></label><p>{fileName}</p><button disabled={!available||!archive||busy} onClick={()=>void request('inspect')}>Inspect archive</button>
    <div className="fields"><label>Question<input value={question} disabled={busy} onChange={e=>editQuery(()=>setQuestion(e.target.value))}/></label><label>Known as of (native checkpoint)<input type="number" value={known} disabled={busy} onChange={e=>editQuery(()=>setKnown(e.target.value))}/></label><label>Valid at (native checkpoint)<input type="number" value={valid} disabled={busy} onChange={e=>editQuery(()=>setValid(e.target.value))}/></label><label>Maximum output bytes<input type="number" min="2048" max="250000" value={budget} disabled={busy} onChange={e=>editQuery(()=>setBudget(e.target.value))}/></label><label>Validity policy<select value={timeMode} disabled={busy} onChange={e=>editQuery(()=>setTimeMode(e.target.value))}><option value="disclose_unknown">Disclose unknown validity</option><option value="require_declared_interval">Require declared interval</option></select></label></div><button disabled={!inspected||busy} onClick={()=>void request('reuse')}>Query core</button></>:<><p><strong>Recorded example:</strong> a precomputed peace Context from the reviewed source-span core. Loading it runs no core query and produces no model answer or quality score.</p><button disabled={busy} onClick={()=>void recorded()}>Load recorded peace Context</button></>}
    <button onClick={()=>{epoch.current.cancel();setBusy(false);setCurrentRun(null);setMessage('Cancelled.');}} disabled={!busy}>Cancel</button><button onClick={()=>reset()}>Reset</button><p role="status">{busy?'Working…':message}</p></section>
    <aside><p>Known-as-of bounds modern source availability; valid-at asks declared world applicability. These examples leave historical applicability unknown; neither establishes what an actor knew in 1914. Assertions remain unreviewed annotations. Graph positions do not measure semantic distance; quoted spans do not verify a complete source file.</p><p>Lichnowsky memoir sections were composed in August 1916 and are retrospective. The declared contemporary graph view excludes them; full Context exports retain all returned content. Gutenberg ebook 39457 rights are USA-specific; other jurisdictions are unverified. Read the complete <a href="/notices/RIGHTS.md">source rights</a> and <a href="/notices/LICENSE-GUTENBERG.txt">Gutenberg terms</a>.</p></aside>
    {inspection&&<details><summary>Exact archive inspection</summary><pre>{inspection}</pre></details>}
    {raw&&<section aria-label="Returned Context"><h2>{mode==='recorded'?'Recorded':'Live'} Context</h2><button onClick={exportContext}>Export exact Context JSON</button>{projection?<><p>Known as of {projection.context.context.known_as_of}; valid at {projection.context.context.valid_at}.</p><Explorer key={raw} graph={projection.graph} initialPerspective={projection.july?'contemporary':'all'}/></>:<p role="alert">Graph projection refused. Unchanged JSON remains available for export.</p>}<details><summary>Full unchanged Context, including omissions</summary><pre>{raw}</pre></details></section>}
    <section aria-label="Optional recorded walkthrough"><h2>Guided evidence walkthrough</h2><p>A separate fixed example explores historical clocks, source qualifications and mixed retrieval measurements. It is not connected to the uploaded archive or live graph selection.</p><button onClick={()=>void loadGuided()}>Load optional recorded walkthrough</button>{guided&&<Suspense fallback={<p>Loading walkthrough…</p>}><GuidedWalkthrough data={guided}/></Suspense>}</section>
    {mode==='live'&&<LiveComparison current={currentRun} baseline={baseline} busy={busy} onSave={()=>{if(currentRun?.context){setBaseline(currentRun);setCurrentRun(null);}}} onClear={()=>setBaseline(null)} onExportA={()=>{if(baseline?.raw)downloadContext(baseline.raw,'live-run-a.context.json');}}/>}
    <CollectionSearch/><footer>Local-only review candidate. Application-source license remains an owner decision; no publication grant is inferred.</footer></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
