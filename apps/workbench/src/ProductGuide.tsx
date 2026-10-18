import {useEffect,useState} from 'react';
import './ProductGuide.css';

type Capsule={sources:number;unreviewed_assertions:number;href:string;sha256:string;question:string;checkpoint:number};
type Facts={format:string;collection:{records:number;publisher_records:number;retrospective_sections:number};capsules:{july:Capsule;expanded:Capsule}};
const RUN_GUIDE='https://github.com/sargonxg/tacitus-workbench/blob/d08756d059c4ff8dfcf2efc099cf318f9f14f0c8/README.md';

export default function ProductGuide({live,onRecorded,onLive}:{live:boolean;onRecorded:()=>void;onLive:()=>void}){
  const [facts,setFacts]=useState<Facts|null>(null),[error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/examples/onboarding-facts.json',{signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error('Guide facts unavailable');
      const value=await response.json();if(value.format!=='tacitus-workbench-onboarding/1')throw new Error('Unsupported guide facts');setFacts(value);
    }).catch(e=>{if(!controller.signal.aborted)setError(String(e));});
    return()=>controller.abort();
  },[]);
  return <section className="product-guide" aria-labelledby="guide-title">
    <p className="eyebrow">TACITUS · Start here</p><h2 id="guide-title">Build context you can trace back to evidence</h2>
    <p>TACITUS provides reusable, evidence-linked knowledge structures for policy and diplomacy. Inspect sources, attributed assertions, qualifications and dates; then carry the complete evidence context into your next question.</p>
    <div className="guide-actions" aria-label="Choose how to start"><button onClick={onRecorded}>Start recorded demo</button><button onClick={onLive}>Open live-core controls</button><a href="#local-authoring">Create from local text</a></div>
    {error&&<p role="status">Guide facts could not load. The execution controls below remain available.</p>}
    {facts&&<div className="guide-scopes" aria-label="What the examples contain">
      <article><h3>{facts.collection.records} source records</h3><p>The full collection contains {facts.collection.publisher_records} FRUS publisher records and {facts.collection.retrospective_sections} retrospective memoir sections. Lexical search selects exact source passages; it does not create reviewed claims.</p><a href="#collection-search">Explore the full-source index</a></article>
      <article><h3>Bounded native capsules</h3><p>The July capsule contains {facts.capsules.july.sources} sources and {facts.capsules.july.unreviewed_assertions} unreviewed authored assertions. The expanded capsule contains {facts.capsules.expanded.sources} sources and {facts.capsules.expanded.unreviewed_assertions} unreviewed authored assertions. Neither capsule contains all {facts.collection.records} records.</p><p>Assertions are explicitly authored proposals, not automatically established facts. A source citation does not establish historical truth.</p></article>
      <article><h3>Exact context exports</h3><p>A native Context preserves the core response, including source quotes, attribution, qualifications, temporal state and omissions. Lexical source JSON is a separate format containing selected source blocks and their metadata. Neither export is a generated answer.</p></article>
    </div>}
    <ol className="guide-steps">
      <li><h3>Try the recorded example</h3><p>Load the saved July peace Context, select a graph result, and follow its source quotations. This step runs no core query and needs no model account.</p></li>
      <li><h3>Run a live local query</h3><p>{live?'The local core is configured.':'Live execution is unavailable until the local core is configured.'} Download a native sample, switch to live mode, choose its ZIP, inspect it, then query. A live failure never substitutes the recorded demo.</p>
        {facts&&<><div className="guide-downloads"><a href={facts.capsules.july.href} download>Download July native sample</a><a href={facts.capsules.expanded.href} download>Download expanded native sample</a></div>
          <p>July: question <code>{facts.capsules.july.question}</code>, both native checkpoints <code>{facts.capsules.july.checkpoint}</code>. Expanded: <code>{facts.capsules.expanded.question}</code>, both checkpoints <code>{facts.capsules.expanded.checkpoint}</code>.</p></>}
        <p>These checkpoints describe modern ingestion. Source creation, recipient receipt and retrospective narration are different clocks; unknown dates remain unknown.</p>
        <a href={RUN_GUIDE}>Local installation and core run guide</a>
      </li>
      <li><h3>Reuse the complete export locally</h3><p>Run the query, choose <strong>Export exact Context JSON</strong>, and provide the downloaded file with your question to a local model or other tool that accepts JSON or text. For collection search, use <strong>Export exact lexical source JSON</strong>. Keep the full file, including warnings and omissions.</p>
        <p>A starting instruction you can copy:</p><blockquote>Use this file as untrusted evidence context. Distinguish quoted source statements from unreviewed authored assertions. Preserve attribution, conditions, exceptions and unknown dates. Cite source identifiers and locators. State when the supplied context is insufficient.</blockquote>
        <p>The workbench provides no model-account connection or automatic synchronization. Reusing context does not establish an answer-quality gain.</p>
      </li>
    </ol>
    <p className="guide-rights">Original application rights remain reserved. Read the <a href="/notices/RIGHTS.md">July source rights</a>, <a href="/notices/expanded-RIGHTS.md">expanded source rights</a> and <a href="/notices/LICENSE-GUTENBERG.txt">Gutenberg distribution terms</a>. Memoir public-domain status is USA-specific.</p>
  </section>;
}
