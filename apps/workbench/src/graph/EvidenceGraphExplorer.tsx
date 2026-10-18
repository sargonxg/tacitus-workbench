'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { calendarDayKey, COLORS, filterGraph, KIND_LABELS, KINDS, layoutGraph, safeSourceUrl, summarizeGraph } from './evidenceGraph';
import type { EvidenceGraph, GraphNode, NodeKind } from './evidenceGraph';
import styles from './EvidenceGraphExplorer.module.css';
import { sourceNoticeFlags } from './sourceNotices';

type Props = { graph: EvidenceGraph; initialPerspective?: 'all' | 'contemporary' | 'retrospective' | 'unknown' };
type View = { zoom: number; x: number; y: number };
const INITIAL_VIEW: View = { zoom: 1, x: 0, y: 0 };
const PAGE_SIZE = 24;
const truncate = (text: string, limit: number) => text.length > limit ? `${text.slice(0, limit)}…` : text;
function useReducedMotion(stopPlaying: (value: boolean) => void) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const change = () => { setReduced(media.matches); if (media.matches) stopPlaying(false); }; change(); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, [stopPlaying]);
  return reduced;
}

/** Entirely read-only. Supply the actual native context projection or the separately labeled corpus projection. */
export default function EvidenceGraphExplorer({ graph, initialPerspective = 'contemporary' }: Props) {
  const uid = useId();
  const [query, setQuery] = useState(''), [kinds, setKinds] = useState<NodeKind[]>(KINDS), [perspective, setPerspective] = useState(initialPerspective);
  const [entityId, setEntityId] = useState(''), [yearFrom, setYearFrom] = useState(''), [yearTo, setYearTo] = useState(''), [includeUndated, setIncludeUndated] = useState(true);
  const [selectedId, setSelectedId] = useState<string | undefined>(), [paging, setPaging] = useState({ key: '', page: 0 }), [view, setView] = useState(INITIAL_VIEW);
  const [cutoffIndex, setCutoffIndex] = useState<number | null>(null), [playing, setPlaying] = useState(false), [twoHop, setTwoHop] = useState(false);
  const reducedMotion = useReducedMotion(setPlaying);
  const paintTiming = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ width: 1000, height: 540 });
  const canvasRef = useRef<HTMLCanvasElement>(null), stageRef = useRef<HTMLDivElement>(null), zoomFrame = useRef(0);
  const drag = useRef<{ pointer: number; x: number; y: number; view: View; moved: boolean } | null>(null);
  const counts = useMemo(() => summarizeGraph(graph), [graph]);
  const notices = sourceNoticeFlags(graph.documents);
  const dates = useMemo(() => Array.from(new Map(graph.documents.flatMap(d => { const key = calendarDayKey(d.date); return key === undefined ? [] : [[key, d.date!.label] as const]; })).entries()).sort((a, b) => a[0] - b[0]), [graph]);
  const entities = useMemo(() => graph.nodes.filter(n => n.kind === 'actor' || n.kind === 'institution').sort((a, b) => a.label.localeCompare(b.label)), [graph]);
  const visible = useMemo(() => filterGraph(graph, { query, kinds, perspective, entityId: entityId || undefined, yearFrom: yearFrom ? Number(yearFrom) : undefined, yearTo: yearTo ? Number(yearTo) : undefined, includeUndated, dateCutoff: cutoffIndex === null ? undefined : dates[cutoffIndex]?.[0] }), [graph, query, kinds, perspective, entityId, yearFrom, yearTo, includeUndated, cutoffIndex, dates]);
  const positions = useMemo(() => layoutGraph(visible.nodes), [visible.nodes]);
  const positionById = useMemo(() => new Map(positions.map(p => [p.id, p])), [positions]);
  const nodeById = useMemo(() => new Map(graph.nodes.map(n => [n.id, n])), [graph]);
  const visibleIds = useMemo(() => new Set(visible.nodes.map(n => n.id)), [visible.nodes]);
  const selected = selectedId && visibleIds.has(selectedId) ? nodeById.get(selectedId) : undefined;
  const allConnections = useMemo(() => selectedId ? graph.edges.filter(e => visibleIds.has(e.from) && visibleIds.has(e.to) && (e.from === selectedId || e.to === selectedId)) : [], [graph.edges, visibleIds, selectedId]);
  const highlighted = useMemo(() => {
    if (!selectedId || !visibleIds.has(selectedId)) return [];
    const neighbors = new Set([selectedId]);
    if (twoHop) for (const e of visible.edges) if (e.from === selectedId || e.to === selectedId) { neighbors.add(e.from); neighbors.add(e.to); }
    return visible.edges.filter(e => neighbors.has(e.from) || neighbors.has(e.to));
  }, [visible.edges, visibleIds, selectedId, twoHop]);
  const highlightedIds = useMemo(() => new Set(highlighted.flatMap(e => [e.from, e.to])), [highlighted]);
  const filterKey = JSON.stringify([query, kinds, perspective, entityId, yearFrom, yearTo, includeUndated, cutoffIndex]);
  const setPage = (page: number) => setPaging({ key: filterKey, page });
  const pageCount = Math.max(1, Math.ceil(visible.nodes.length / PAGE_SIZE)), safePage = paging.key === filterKey ? Math.min(paging.page, pageCount - 1) : 0;
  const pageNodes = visible.nodes.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const projection = useMemo(() => { const fit = Math.min(size.width / 1200, size.height / 720); return { scale: fit * view.zoom, x: size.width / 2 - 600 * fit * view.zoom + view.x, y: size.height / 2 - 360 * fit * view.zoom + view.y }; }, [view, size]);
  const reset = () => { cancelAnimationFrame(zoomFrame.current); setQuery(''); setKinds(KINDS); setPerspective(initialPerspective); setEntityId(''); setYearFrom(''); setYearTo(''); setIncludeUndated(true); setCutoffIndex(null); setPlaying(false); setView(INITIAL_VIEW); setPage(0); };
  const select = (node: GraphNode) => { setSelectedId(node.id); };
  function moveView(next: View) {
    cancelAnimationFrame(zoomFrame.current);
    if (reducedMotion) { setView(next); return; }
    const from = view, start = performance.now();
    function tick(now: number) { const t = Math.min(1, (now - start) / 180), ease = 1 - (1 - t) ** 3; setView({ zoom: from.zoom + (next.zoom - from.zoom) * ease, x: from.x + (next.x - from.x) * ease, y: from.y + (next.y - from.y) * ease }); if (t < 1) zoomFrame.current = requestAnimationFrame(tick); }
    zoomFrame.current = requestAnimationFrame(tick);
  }
  const zoom = (factor: number) => moveView({ ...view, zoom: Math.max(0.7, Math.min(12, view.zoom * factor)) });
  useEffect(() => () => cancelAnimationFrame(zoomFrame.current), []);
  useEffect(() => {
    const element = stageRef.current; if (!element) return;
    const observer = new ResizeObserver(entries => { const { width, height } = entries[0].contentRect; setSize({ width: Math.max(1, width), height: Math.max(1, height) }); });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!playing || reducedMotion || dates.length < 2) return;
    const timer = window.setInterval(() => setCutoffIndex(previous => { const next = (previous ?? -1) + 1; if (next >= dates.length - 1) setPlaying(false); return Math.min(next, dates.length - 1); }), 1100);
    return () => window.clearInterval(timer);
  }, [playing, reducedMotion, dates.length]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); if (!ctx) return;
    const start = performance.now(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.width * dpr); canvas.height = Math.round(size.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#07111d'; ctx.fillRect(0, 0, size.width, size.height);
    ctx.save(); ctx.translate(projection.x, projection.y); ctx.scale(projection.scale, projection.scale);
    const laneWidth = 1120 / KINDS.length;
    for (let lane = 0; lane < KINDS.length; lane++) {
      ctx.strokeStyle = '#213448'; ctx.lineWidth = 1 / projection.scale; ctx.beginPath(); ctx.moveTo(40 + lane * laneWidth, 45); ctx.lineTo(40 + lane * laneWidth, 690); ctx.stroke();
      ctx.fillStyle = COLORS[KINDS[lane]]; ctx.font = `${11 / projection.scale}px system-ui`; ctx.fillText(['Sources', 'Spans', 'Claims', 'Actors', 'Inst.', 'Events'][lane], 45 + lane * laneWidth, 30);
    }
    ctx.lineWidth = 1.1 / projection.scale;
    for (const edge of highlighted.slice(0, 100)) {
      const from = positionById.get(edge.from), to = positionById.get(edge.to); if (!from || !to) continue;
      ctx.strokeStyle = edge.kind === 'contradicts' ? '#ee9393' : '#e6ba78'; ctx.setLineDash(edge.kind === 'contains' ? [] : [4 / projection.scale, 4 / projection.scale]);
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const kind of KINDS) {
      ctx.fillStyle = COLORS[kind]; ctx.beginPath();
      for (const point of positions) {
        const n = nodeById.get(point.id); if (n?.kind !== kind) continue;
        const x = point.x * projection.scale + projection.x, y = point.y * projection.scale + projection.y;
        if (x < -10 || y < -10 || x > size.width + 10 || y > size.height + 10) continue;
        const radius = Math.min(4.5, Math.max(1.3, 450 / Math.sqrt(visible.nodes.length + 1))) / Math.sqrt(view.zoom);
        ctx.moveTo(point.x + radius, point.y); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    for (const id of highlightedIds) {
      const point = positionById.get(id); if (!point) continue;
      ctx.strokeStyle = '#f4dfba'; ctx.lineWidth = 1.5 / projection.scale; ctx.beginPath(); ctx.arc(point.x, point.y, 7 / Math.sqrt(view.zoom), 0, Math.PI * 2); ctx.stroke();
    }
    const point = selectedId ? positionById.get(selectedId) : undefined;
    if (point) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 / projection.scale; ctx.beginPath(); ctx.arc(point.x, point.y, 10 / Math.sqrt(view.zoom), 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    const elapsed = performance.now() - start; if (paintTiming.current) paintTiming.current.textContent = `${elapsed.toFixed(1)} ms last Canvas draw`;
  }, [positions, positionById, nodeById, size, projection, highlighted, highlightedIds, selectedId, view.zoom, visible.nodes.length]);
  function pick(clientX: number, clientY: number) {
    const bounds = canvasRef.current?.getBoundingClientRect(); if (!bounds) return;
    const x = (clientX - bounds.left - projection.x) / projection.scale, y = (clientY - bounds.top - projection.y) / projection.scale;
    let best: string | undefined, distance = (12 / projection.scale) ** 2;
    for (const p of positions) { const squared = (p.x - x) ** 2 + (p.y - y) ** 2; if (squared < distance) { best = p.id; distance = squared; } }
    if (best) setSelectedId(best);
  }
  const detailEvidence = selected?.evidence.length ? selected.evidence : selected ? graph.nodes.filter(n => n.kind === 'passage' && n.sourceIds.some(id => selected.sourceIds.includes(id))).slice(0, 6).flatMap(n => n.evidence) : [];
  return <section className={styles.explorer} aria-labelledby={`${uid}-title`}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>{graph.synthetic ? 'SYNTHETIC PERFORMANCE FIXTURE' : 'SOURCE-BOUND EVIDENCE ATLAS'}</p><h2 id={`${uid}-title`}>{graph.title}</h2><p>Explore the record. Inspect the evidence. Keep uncertainty visible.</p></div>
      <div className={styles.total}><strong>{graph.nodes.length.toLocaleString()}</strong><span>{graph.synthetic ? 'synthetic test nodes' : 'source and annotation nodes'}</span></div>
    </header>
    {graph.synthetic && <p role="note" className={styles.caution}>Synthetic stress test. These nodes are not historical evidence and are excluded from the collection’s real-data count.</p>}
    {(perspective === 'all' || perspective === 'retrospective') && notices.retrospective && <aside className={styles.caution} aria-label="Retrospective source status"><strong>Retrospective sources may contain hindsight.</strong><p>Do not treat this material as available at the earlier events it describes. Composition, publication, receipt and rights must be checked for each work; retrospective status does not identify its author or license.</p></aside>}
    {(perspective === 'all' || perspective === 'retrospective') && notices.lichnowsky && <aside className={styles.caution} aria-label="Retrospective source rights"><strong>Lichnowsky memoir: retrospective testimony, composed in August 1916. Public-domain status is declared for the USA only.</strong><p>This eBook is for the use of anyone anywhere in the United States and most other parts of the world at no cost and with almost no restrictions whatsoever. You may copy it, give it away or re-use it under the terms of the <a href="https://www.gutenberg.org/policy/license.html" target="_blank" rel="noopener noreferrer">Project Gutenberg™ License</a> included with this eBook or online at www.gutenberg.org. If you are not located in the United States, you will have to check the laws of the country where you are located before using this eBook.</p></aside>}
    {notices.otherGutenberg && <aside className={styles.caution} aria-label="Gutenberg distribution notice"><strong>Gutenberg-associated material: consult this work&apos;s own rights and edition notes.</strong><p>No specific author, ebook number or jurisdictional status is inferred. Preserve the supplied work-specific notices and <a href="https://www.gutenberg.org/policy/license.html" target="_blank" rel="noopener noreferrer">Gutenberg distribution terms</a>.</p></aside>}
    <div className={styles.counts}>{KINDS.map(kind => <button key={kind} type="button" aria-pressed={kinds.includes(kind)} onClick={() => setKinds(value => value.includes(kind) ? value.filter(k => k !== kind) : [...value, kind])}><i style={{ background: COLORS[kind] }} aria-hidden="true" /><strong>{counts[kind].toLocaleString()}</strong><span>{KIND_LABELS[kind]}</span></button>)}</div>
    <div className={styles.filters}>
      <label className={styles.search}>Search text, actors or evidence<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search the documentary record" /></label>
      <label>Source perspective<select value={perspective} onChange={e => setPerspective(e.target.value as typeof perspective)}><option value="contemporary">Contemporary sources</option><option value="retrospective">Retrospective sources</option><option value="unknown">Unclassified sources</option><option value="all">All perspectives</option></select></label>
      <label>Actor / institution source neighborhood<select value={entityId} onChange={e => setEntityId(e.target.value)}><option value="">All source neighborhoods</option>{entities.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></label>
      <label>Source year from<input inputMode="numeric" type="number" min="1" max="9999" value={yearFrom} onChange={e => setYearFrom(e.target.value)} /></label>
      <label>To<input inputMode="numeric" type="number" min="1" max="9999" value={yearTo} onChange={e => setYearTo(e.target.value)} /></label>
      <label className={styles.check}><input type="checkbox" checked={includeUndated} onChange={e => setIncludeUndated(e.target.checked)} />Include unknown / partial dates</label>
      <button type="button" onClick={reset}>Reset filters</button>
    </div>
    <p className={styles.explanation}>Positions group node types and source IDs. Distance is not a historical relationship. Actor filtering includes documents that share an annotation; it does not assert that every passage mentions that actor.</p>
    {dates.length > 0 && <div className={styles.timeline}><div><strong>Document-date sequence</strong><span>{cutoffIndex === null ? 'All documented dates' : `Through ${dates[cutoffIndex]?.[1]}`}</span></div><input aria-label="Document-date cutoff" type="range" min="0" max={dates.length - 1} value={cutoffIndex ?? dates.length - 1} onChange={e => { setCutoffIndex(Number(e.target.value)); setPlaying(false); }} /><button type="button" disabled={reducedMotion || dates.length < 2} onClick={() => { if (cutoffIndex === dates.length - 1) setCutoffIndex(null); setPlaying(!playing); }}>{playing ? 'Pause' : 'Play dates'}</button><button type="button" onClick={() => { setPlaying(false); setCutoffIndex(null); }}>Show all dates</button><small>{reducedMotion ? 'Motion is off by device preference. Use the slider to step dates. ' : ''}This orders source documents; it does not reconstruct what an actor knew at the time.</small></div>}
    <div className={styles.workspace}>
      <div className={styles.visualColumn}>
        <div className={styles.toolbar}><span role="status" aria-live="polite">{visible.nodes.length.toLocaleString()} of {graph.nodes.length.toLocaleString()} nodes · {visible.edges.length.toLocaleString()} eligible edges</span><button type="button" aria-label="Zoom out" onClick={() => zoom(0.75)}>−</button><span>{Math.round(view.zoom * 100)}%</span><button type="button" aria-label="Zoom in" onClick={() => zoom(1.35)}>+</button><button type="button" onClick={() => moveView(INITIAL_VIEW)}>Fit</button><a href={`#${uid}-results`}>Use accessible results</a></div>
        <div ref={stageRef} className={styles.stage}>
          <canvas ref={canvasRef} aria-hidden="true" onPointerDown={e => { cancelAnimationFrame(zoomFrame.current); drag.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY, view, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { const start = drag.current; if (!start || start.pointer !== e.pointerId) return; const x = e.clientX - start.x, y = e.clientY - start.y; if (Math.abs(x) + Math.abs(y) > 4) start.moved = true; if (start.moved) setView({ ...start.view, x: start.view.x + x, y: start.view.y + y }); }} onPointerUp={e => { const start = drag.current; if (start && !start.moved) pick(e.clientX, e.clientY); drag.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }} onPointerCancel={() => { drag.current = null; }} />
          {visible.nodes.length === 0 && <div className={styles.empty}><strong>No nodes match these filters.</strong><p>Try all perspectives or reset the search. Unclassified sources are not silently treated as contemporary.</p><button type="button" onClick={reset}>Reset filters</button></div>}
          <div className={styles.stageCaption}>Drag to pan · Zoom to separate dense passages · Select a point or a result</div>
        </div>
        <div className={styles.graphNotes}><label className={styles.check}><input type="checkbox" checked={twoHop} onChange={e => setTwoHop(e.target.checked)} />Highlight two-step paths</label><span>{selected && visibleIds.has(selected.id) ? `${Math.min(100, highlighted.length)} of ${highlighted.length} neighborhood edges drawn` : 'Select a node to reveal its evidence paths'}</span><span ref={paintTiming}>Canvas timing pending</span></div>
        <p className={styles.explanation}>Draw time measures this browser’s synchronous Canvas commands, excluding layout, GPU presentation and network. It is not an FPS or end-to-end latency benchmark.</p>
      </div>
      <aside className={styles.inspector} aria-labelledby={`${uid}-detail`}>
        <h3 id={`${uid}-detail`}>Evidence inspector</h3>{selectedId && !visibleIds.has(selectedId) && <p role="status" className={styles.caution}>Selected node is outside the current filters. Choose a visible result or reset filters.</p>}
        {selected ? <><p className={styles.eyebrow}>{KIND_LABELS[selected.kind]}</p><h4>{selected.label}</h4><p className={styles.caution}>{selected.uncertainty}</p><p>{selected.date ? `Source date: ${selected.date.label} (${selected.date.precision} precision${selected.date.calendar ? `, ${selected.date.calendar}` : ''})` : 'Source date: not assigned'}</p>
          <dl>{Object.entries(selected.metadata).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
          {selected.conditions.length > 0 && <><h4>Conditions</h4><ul>{selected.conditions.map((text, i) => <li key={i}>{text}</li>)}</ul></>}{selected.exceptions.length > 0 && <><h4>Exceptions</h4><ul>{selected.exceptions.map((text, i) => <li key={i}>{text}</li>)}</ul></>}
          <h4>{selected.evidence.length ? 'Bound source quotations' : 'Source-neighborhood excerpts (up to 6)'}</h4>
          {detailEvidence.length ? detailEvidence.map((ev, i) => <article className={styles.quote} key={`${ev.sourceId}-${ev.start}-${i}`}><strong>{ev.title}</strong><blockquote>{ev.quote}</blockquote><small>{ev.locator || `UTF-8 bytes ${ev.start}–${ev.end}`} · byte range [{ev.start}, {ev.end})<br />{ev.date?.label || 'Date not supplied'} · {ev.license}<br />{ev.verification === 'sha256-and-utf8-span' ? 'Full source SHA-256 and exact UTF-8 span checked' : 'Native context excerpt; span length checked, full text unavailable here'}</small><details><summary>Source hash</summary><code>{ev.textHash}</code></details>{safeSourceUrl(ev.url) && <a href={safeSourceUrl(ev.url)} target="_blank" rel="noopener noreferrer">Open original source ↗</a>}</article>) : <p>No quotation is available for this selection.</p>}
          <h4>Declared connections ({allConnections.length})</h4><ul className={styles.connections}>{allConnections.slice(0, 100).map(edge => { const other = nodeById.get(edge.from === selected.id ? edge.to : edge.from); return <li key={edge.id}><span>{edge.label}</span>{other && <button type="button" onClick={() => select(other)}>{truncate(other.label, 100)}</button>}{edge.rationale && <p>{edge.rationale}</p>}</li>; })}</ul>{allConnections.length > 100 && <p>First 100 connections shown. Narrow the graph to inspect a smaller neighborhood.</p>}
        </> : <div className={styles.placeholder}><strong>Start with a source or an actor.</strong><p>Every displayed connection keeps its meaning, evidence and review status. No spatial proximity is treated as proof.</p></div>}
      </aside>
    </div>
    <section id={`${uid}-results`} className={styles.results} aria-labelledby={`${uid}-results-title`} tabIndex={-1}>
      <div className={styles.resultsHeader}><h3 id={`${uid}-results-title`}>Accessible results</h3><span>Page {safePage + 1} of {pageCount}</span><button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</button><button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>Next</button></div>
      <ul>{pageNodes.map(n => <li key={n.id}><button type="button" aria-pressed={n.id === selectedId} onClick={() => select(n)}><span style={{ color: COLORS[n.kind] }}>{KIND_LABELS[n.kind]}</span><strong>{truncate(n.label, 160)}</strong><small>{n.date?.label || 'Date not assigned'} · {n.metadata.perspective || 'unclassified'}</small></button></li>)}</ul>
    </section>
    <details className={styles.warnings}><summary>Provenance, limitations and omitted material</summary><ul>{graph.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>
  </section>;
}
