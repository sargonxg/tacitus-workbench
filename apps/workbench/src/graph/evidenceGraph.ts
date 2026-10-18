/** Read-only projection. It never promotes assertions or infers a historical relationship. */
export type NodeKind = 'document' | 'passage' | 'claim' | 'actor' | 'institution' | 'event';
export type SourceDate = { label: string; year?: number; month?: number; day?: number; precision: 'day' | 'month' | 'year' | 'unknown'; calendar?: string };
export type SourceDocument = { id: string; title: string; text: string; textHash: string; url?: string; license: string; date?: SourceDate; family?: string; author?: string; version?: number; perspective?: 'contemporary' | 'retrospective' | 'unknown'; blocks?: { id: string; kind: string; start: number; end: number; text: string; locator: string }[]; };
export type Evidence = { sourceId: string; title: string; quote: string; start: number; end: number; textHash: string; locator?: string; url?: string; license: string; date?: SourceDate; verification: 'sha256-and-utf8-span' | 'context-excerpt-only'; };
export type GraphNode = { id: string; kind: NodeKind; label: string; sourceIds: string[]; evidence: Evidence[]; date?: SourceDate; uncertainty: string; conditions: string[]; exceptions: string[]; metadata: Record<string, string>; searchText: string; };
export type GraphEdge = { id: string; from: string; to: string; kind: 'contains' | 'evidence_for' | 'annotated_in' | 'contradicts' | 'supersedes' | 'depends_on' | 'source_marked'; label: string; rationale?: string; };
export type EvidenceGraph = { id: string; title: string; synthetic: boolean; nodes: GraphNode[]; edges: GraphEdge[]; documents: SourceDocument[]; warnings: string[]; };
export type NativeSpan = { source: string; text_hash: string; start: number; end: number; locator?: string | null; };
export type NativeCapture = {
  manifest: { id: string; title: string; limitations?: string[]; };
  documents: { id: string; version: number; title: string; text: string; text_hash: string; license?: string | null; source_family?: string; author?: string; redistributable: boolean; restricted: boolean; withdrawn: boolean; }[];
  assertions: { id: string; proposition: string; subject: string; predicate: string; object?: string | null; speaker: string; epistemic_type: string; modality: string; conditions: string[]; exceptions: string[]; evidence: NativeSpan[]; }[];
  graph: { version: string; nodes: Record<string, { id: string; kind: 'actor' | 'institution' | 'event'; label: string; claims: string[]; event_time?: number | null; }>; links: { from: string; to: string; kind: 'contradicts' | 'supersedes' | 'depends_on'; rationale: string; }[]; knowledge?: Record<string, string>; };
  extractor: string;
};
export type GraphInput = { id: string; title: string; documents: SourceDocument[]; capture?: NativeCapture; synthetic?: boolean; includePassages?: boolean; };
export const KINDS: NodeKind[] = ['document', 'passage', 'claim', 'actor', 'institution', 'event'];
export const KIND_LABELS: Record<NodeKind, string> = { document: 'Sources', passage: 'Structural passages', claim: 'Unreviewed assertions', actor: 'Actors', institution: 'Institutions', event: 'Events' };
export const COLORS: Record<NodeKind, string> = { document: '#75b8ef', passage: '#8ca5bc', claim: '#e6ba78', actor: '#8cd6bf', institution: '#c9a4e6', event: '#ef9d9d' };
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const key = (kind: NodeKind, id: string) => `${kind}:${id}`;
const cmp = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function ensure(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export function safeSourceUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try { const url = new URL(value); return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}
/** Offsets are UTF-8 bytes, never JavaScript UTF-16 code units. */
export function quoteFromUtf8(text: string, start: number, end: number): string {
  const bytes = encoder.encode(text);
  ensure(Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && end > start && end <= bytes.length, 'Invalid evidence byte span');
  try { return decoder.decode(bytes.subarray(start, end)); } catch { throw new Error('Evidence span splits a UTF-8 character'); }
}
export async function sha256Text(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
function validateDate(date?: SourceDate): void {
  if (!date) return;
  ensure(typeof date.label === 'string' && ['day', 'month', 'year', 'unknown'].includes(date.precision), 'Invalid source date');
  if (date.year !== undefined) ensure(Number.isInteger(date.year) && date.year > 0 && date.year < 10000, 'Invalid source year');
  if (date.month !== undefined) ensure(Number.isInteger(date.month) && date.month >= 1 && date.month <= 12 && date.year !== undefined, 'Invalid source month');
  if (date.day !== undefined) ensure(Number.isInteger(date.day) && date.day >= 1 && date.day <= 31 && date.month !== undefined, 'Invalid source day');
}
function node(kind: NodeKind, id: string, label: string, sourceIds: string[], evidence: Evidence[], extra: Partial<GraphNode> = {}): GraphNode {
  return { id: key(kind, id), kind, label, sourceIds, evidence, uncertainty: kind === 'document' || kind === 'passage' ? 'Source text is evidence of what this document says, not proof of its accuracy.' : 'Authored annotation; unreviewed and not established historical fact.', conditions: [], exceptions: [], metadata: {}, searchText: '', ...extra };
}
function evidence(document: SourceDocument, start: number, end: number, locator?: string): Evidence {
  return { sourceId: document.id, title: document.title, quote: quoteFromUtf8(document.text, start, end), start, end, textHash: document.textHash, locator, url: safeSourceUrl(document.url), license: document.license, date: document.date, verification: 'sha256-and-utf8-span' };
}
/** Nonblank lines reflect source structure. Long lines stay intact; no invented sentence or claim boundaries. */
export function structuralSpans(text: string): { start: number; end: number; line: number }[] {
  const spans: { start: number; end: number; line: number }[] = [];
  let offset = 0, line = 0;
  for (const match of text.matchAll(/[^\n]*(?:\n|$)/g)) {
    if (!match[0]) continue;
    line += 1;
    const raw = match[0], content = raw.replace(/[\r\n]+$/, '');
    if (content.trim()) spans.push({ start: offset, end: offset + encoder.encode(content).length, line });
    offset += encoder.encode(raw).length;
  }
  return spans;
}
/** Rejects broken references and hashes. Capture trust/review status stays unreviewed. */
export async function buildEvidenceGraph(input: GraphInput): Promise<EvidenceGraph> {
  ensure(input.documents.length > 0 && input.documents.length <= 10000, 'Expected 1–10,000 source documents');
  const documents = input.documents.map(d => ({ ...d, url: safeSourceUrl(d.url) }));
  const sources = new Map<string, SourceDocument>();
  const nodes: GraphNode[] = [], edges: GraphEdge[] = [];
  const appendEdge = (from: string, to: string, kind: GraphEdge['kind'], label: string, rationale?: string) => edges.push({ id: `edge:${edges.length}`, from, to, kind, label, rationale });
  let bytes = 0;
  for (const document of documents) {
    ensure(document.id && document.title && document.license && typeof document.text === 'string', 'Source identity, title, license and exact text required');
    ensure(!sources.has(document.id), `Duplicate source: ${document.id}`);
    bytes += encoder.encode(document.text).length;
    ensure(bytes <= 32 * 1024 * 1024, 'Graph source texts exceed the 32 MiB browser bound');
    validateDate(document.date);
    ensure(/^[a-f0-9]{64}$/.test(document.textHash), `Invalid source SHA-256: ${document.id}`);
    ensure(await sha256Text(document.text) === document.textHash, `Source SHA-256 mismatch: ${document.id}`);
    sources.set(document.id, document);
    nodes.push(node('document', document.id, document.title, [document.id], [], { date: document.date, metadata: { license: document.license, sha256: document.textHash, author: document.author || 'Not supplied', sourceFamily: document.family || 'Not supplied', perspective: document.perspective || 'unknown' } }));
    if (input.includePassages !== false) {
      for (const span of document.blocks || structuralSpans(document.text).map(s => ({ ...s, locator: `Source text line ${s.line}`, kind: 'nonblank line', text: undefined }))) {
        const ev = evidence(document, span.start, span.end, span.locator);
        ensure(span.text === undefined || span.text === ev.quote, `Structural block text mismatch: ${document.id}`);
        const passage = node('passage', `${document.id}:${span.start}-${span.end}`, ev.quote, [document.id], [ev], { date: document.date, metadata: { structure: `${span.kind}; source structure, not an extracted assertion`, perspective: document.perspective || 'unknown' } });
        nodes.push(passage);
        appendEdge(key('document', document.id), passage.id, 'contains', 'contains structural passage');
      }
    }
    ensure(nodes.length <= 100000, 'Graph exceeds 100,000 nodes; narrow the corpus');
  }
  const capture = input.capture;
  const warnings: string[] = ['Document-date filtering is not event validity or knowledge-as-of filtering.', 'A line count is not a count of semantic facts.'];
  if (capture) {
    ensure(capture.graph.version === 'tacitus-policy-graph-sidecar/1', 'Unsupported graph sidecar');
    warnings.push(...(capture.manifest.limitations || []));
    const nativeSources = new Map<string, SourceDocument>();
    for (const d of capture.documents) {
      ensure(d.redistributable && !d.restricted && !d.withdrawn, `Unavailable native source: ${d.id}`);
      const document = sources.get(d.id);
      ensure(document && document.textHash === d.text_hash && document.text === d.text, `Native source does not match verified corpus: ${d.id}`);
      const nativeKey = `${d.id}@${d.version}`;
      ensure(!nativeSources.has(nativeKey), `Duplicate native source: ${nativeKey}`);
      nativeSources.set(nativeKey, document);
    }
    const claims = new Map<string, GraphNode>();
    for (const claim of capture.assertions) {
      ensure(!claims.has(claim.id) && claim.evidence.length > 0, `Duplicate or evidence-free assertion: ${claim.id}`);
      const citations = claim.evidence.map(span => {
        const source = nativeSources.get(span.source);
        ensure(source && span.text_hash === source.textHash, `Unknown or hash-mismatched evidence: ${span.source}`);
        return evidence(source, span.start, span.end, span.locator || undefined);
      });
      const sourceIds = Array.from(new Set(citations.map(e => e.sourceId)));
      const dates = citations.map(e => e.date).filter(Boolean) as SourceDate[];
      const sameDate = dates.length === citations.length && dates.every(d => JSON.stringify(d) === JSON.stringify(dates[0])) ? dates[0] : undefined;
      const n = node('claim', claim.id, claim.proposition, sourceIds, citations, { date: sameDate, conditions: claim.conditions, exceptions: claim.exceptions, metadata: { speaker: claim.speaker, subject: claim.subject, predicate: claim.predicate, object: claim.object || 'Not supplied', epistemicType: claim.epistemic_type, modality: claim.modality, knowledge: capture.graph.knowledge?.[claim.id] || 'unknown', extractor: capture.extractor, dateBasis: 'Source-document date only; event validity is not inferred', perspective: sourceIds.map(id => sources.get(id)?.perspective || 'unknown').includes('retrospective') ? 'retrospective' : sourceIds.every(id => sources.get(id)?.perspective === 'contemporary') ? 'contemporary' : 'unknown' } });
      claims.set(claim.id, n); nodes.push(n);
      for (const sourceId of sourceIds) appendEdge(key('document', sourceId), n.id, 'evidence_for', 'supplies quoted evidence for');
    }
    for (const [nativeId, entity] of Object.entries(capture.graph.nodes)) {
      ensure(nativeId === entity.id && ['actor', 'institution', 'event'].includes(entity.kind), 'Invalid typed entity');
      const annotations = entity.claims.map(id => { const claim = claims.get(id); ensure(claim, `Entity references missing assertion: ${id}`); return claim; });
      ensure(annotations.length, 'Entity has no assertion provenance');
      const n = node(entity.kind, entity.id, entity.label, Array.from(new Set(annotations.flatMap(c => c.sourceIds))), [], { metadata: { annotationEventTime: entity.event_time == null ? 'Not supplied' : String(entity.event_time), dateBasis: 'No source-document date assigned to entity' } });
      nodes.push(n);
      for (const claim of annotations) appendEdge(n.id, claim.id, 'annotated_in', 'associated by unreviewed annotation');
    }
    for (const link of capture.graph.links) {
      const from = claims.get(link.from), to = claims.get(link.to);
      ensure(from && to && ['contradicts', 'supersedes', 'depends_on'].includes(link.kind), 'Invalid assertion relationship');
      appendEdge(from.id, to.id, link.kind, `unreviewed ${link.kind.replace('_', ' ')} annotation`, link.rationale);
    }
  }
  const ids = new Set<string>();
  for (const n of nodes) {
    ensure(!ids.has(n.id), `Duplicate graph node: ${n.id}`); ids.add(n.id);
    n.searchText = [n.label, n.kind, ...n.sourceIds, ...n.conditions, ...n.exceptions, ...Object.values(n.metadata), ...n.evidence.map(e => e.quote)].join(' ').toLocaleLowerCase();
  }
  ensure(nodes.length <= 100000 && edges.length <= 200000, 'Graph exceeds browser projection bound');
  return { id: input.id, title: input.title, synthetic: input.synthetic === true, nodes, edges, documents, warnings };
}
export type GraphFilter = { query?: string; kinds?: NodeKind[]; yearFrom?: number; yearTo?: number; includeUndated?: boolean; entityId?: string; perspective?: 'all' | 'contemporary' | 'retrospective' | 'unknown'; dateCutoff?: number; };
export function filterGraph(graph: EvidenceGraph, filter: GraphFilter): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const terms = (filter.query || '').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const kinds = filter.kinds ? new Set(filter.kinds) : undefined;
  let entityScope: Set<string> | undefined;
  if (filter.entityId) {
    const sourceIds = new Set(graph.nodes.find(n => n.id === filter.entityId)?.sourceIds || []);
    entityScope = new Set(graph.nodes.filter(n => n.id === filter.entityId || n.sourceIds.some(s => sourceIds.has(s))).map(n => n.id));
  }
  const hasDateFilter = filter.yearFrom !== undefined || filter.yearTo !== undefined;
  const documents = new Map(graph.documents.map(d => [d.id, d]));
  const nodes = graph.nodes.filter(n => {
    if (kinds && !kinds.has(n.kind)) return false;
    if (filter.perspective && filter.perspective !== 'all' && n.metadata.perspective !== filter.perspective) return false;
    if (filter.dateCutoff !== undefined) {
      const date = calendarDayKey(n.date);
      if (date === undefined && ['actor', 'institution', 'event'].includes(n.kind)) {
        const associated = n.sourceIds.map(id => calendarDayKey(documents.get(id)?.date)).filter((d): d is number => d !== undefined);
        if (associated.length ? !associated.some(d => d <= filter.dateCutoff!) : !filter.includeUndated) return false;
      } else if (date === undefined ? (!filter.includeUndated || n.metadata.perspective === 'retrospective') : date > filter.dateCutoff) return false;
    }
    if (entityScope && !entityScope.has(n.id)) return false;
    if (!terms.every(term => n.searchText.includes(term))) return false;
    if (hasDateFilter && n.date?.year === undefined) return filter.includeUndated === true;
    if (filter.yearFrom !== undefined && (n.date?.year ?? Infinity) < filter.yearFrom) return false;
    if (filter.yearTo !== undefined && (n.date?.year ?? -Infinity) > filter.yearTo) return false;
    return true;
  });
  const ids = new Set(nodes.map(n => n.id));
  return { nodes, edges: graph.edges.filter(e => ids.has(e.from) && ids.has(e.to)) };
}
export type Position = { id: string; x: number; y: number; };
/** Deterministic source-ID order inside type lanes. Position does not imply semantic distance. */
export function layoutGraph(nodes: GraphNode[], width = 1200, height = 720): Position[] {
  const result: Position[] = [], laneWidth = (width - 80) / KINDS.length;
  for (let lane = 0; lane < KINDS.length; lane++) {
    const group = nodes.filter(n => n.kind === KINDS[lane]).sort((a, b) => cmp(a.id, b.id));
    const cols = Math.max(1, Math.ceil(Math.sqrt(group.length * laneWidth / (height - 100))));
    const rows = Math.max(1, Math.ceil(group.length / cols));
    for (let i = 0; i < group.length; i++) result.push({ id: group[i].id, x: 40 + lane * laneWidth + ((i % cols) + 0.5) * laneWidth / cols, y: 70 + (Math.floor(i / cols) + 0.5) * (height - 100) / rows });
  }
  return result;
}
export function summarizeGraph(graph: EvidenceGraph): Record<NodeKind, number> {
  const counts = Object.fromEntries(KINDS.map(k => [k, 0])) as Record<NodeKind, number>;
  for (const n of graph.nodes) counts[n.kind] += 1;
  return counts;
}

/** Sort key for explicitly supplied Gregorian day dates; not a UTC instant. */
export function calendarDayKey(date?: SourceDate): number | undefined {
  if (!date || date.precision !== 'day' || date.year === undefined || date.month === undefined || date.day === undefined || (date.calendar && date.calendar.toLowerCase() !== 'gregorian')) return undefined;
  return date.year * 10000 + date.month * 100 + date.day;
}
export type NativeContext = {
  format: 'tacitus-uploaded-knowledge-context/1'; archive_digest: string; status: string;
  manifest: { id: string; title: string; limitations: string[]; };
  context: { format: string; ontology: string; trust: string; question: string; known_as_of: number; valid_at: number;
    claims: Record<string, { assertion: NativeCapture['assertions'][number]; knowledge: string; citations: { span: NativeSpan; text: string; title: string; family: string; license: string; }[]; }>;
    entities: NativeCapture['graph']['nodes']; relationships: NativeCapture['graph']['links']; omissions: Record<string, string>; warnings: string[]; };
  temporal_status: Record<string, string>; observed_at: Record<string, number | null>;
  source_metadata: Record<string, { id: string; version: number; title: string; text_hash: string; license: string; author: string; source_family: string; published_at: number | null; available_at: number; document_id?: string; valid_from?: number | null; valid_until?: number | null; restricted: boolean; withdrawn: boolean; }>;
};
export type SourcePresentation = { url?: string; date?: SourceDate; perspective?: SourceDocument['perspective']; };
/** Exact CLI reuse output. Does NOT pretend excerpts can verify full source hashes. */
export function graphFromContext(value: NativeContext, presentation: Record<string, SourcePresentation> = {}, synthetic = false): EvidenceGraph {
  ensure(value.format === 'tacitus-uploaded-knowledge-context/1' && value.context.format === 'tacitus-layered-policy-context/1', 'Unsupported context format');
  ensure(/^[a-f0-9]{64}$/.test(value.archive_digest), 'Missing archive digest');
  const nodes: GraphNode[] = [], edges: GraphEdge[] = [], documents: SourceDocument[] = [];
  const appendEdge = (from: string, to: string, kind: GraphEdge['kind'], label: string, rationale?: string) => edges.push({ id: `edge:${edges.length}`, from, to, kind, label, rationale });
  const sources = new Map<string, SourceDocument>();
  for (const [sourceKey, source] of Object.entries(value.source_metadata)) {
    ensure(sourceKey === `${source.id}@${source.version}` && !source.restricted && !source.withdrawn, 'Unavailable or mismatched context source');
    ensure(/^[a-f0-9]{64}$/.test(source.text_hash), 'Invalid context source hash');
    const shown = presentation[sourceKey] || {};
    validateDate(shown.date);
    const document: SourceDocument = { id: sourceKey, title: source.title, text: '', textHash: source.text_hash, license: source.license, author: source.author, family: source.source_family, ...shown, url: safeSourceUrl(shown.url) || safeSourceUrl(source.document_id) };
    sources.set(sourceKey, document); documents.push(document);
    nodes.push(node('document', sourceKey, source.title, [sourceKey], [], { date: shown.date, metadata: { sha256: source.text_hash, license: source.license, perspective: shown.perspective || 'unknown', sourcePublishedAt: source.published_at == null ? 'Unknown' : String(source.published_at), sourceAvailableAt: String(source.available_at), verification: 'Full text is not included in reuse output. Archive validation belongs to the CLI.' } }));
  }
  const passages = new Map<string, GraphNode>(), claims = new Map<string, GraphNode>();
  for (const [id, layer] of Object.entries(value.context.claims)) {
    const assertion = layer.assertion;
    ensure(id === assertion.id && layer.citations.length > 0, 'Mismatched or evidence-free context assertion');
    ensure(assertion.evidence.length === layer.citations.length, 'Citation count differs from assertion evidence');
    const spanKey = (span: NativeSpan) => JSON.stringify([span.source, span.text_hash, span.start, span.end]);
    ensure(JSON.stringify(assertion.evidence.map(spanKey).sort()) === JSON.stringify(layer.citations.map(c => spanKey(c.span)).sort()), 'Citations do not exactly match assertion evidence');
    const citations = layer.citations.map(citation => {
      const { span } = citation, source = sources.get(span.source);
      ensure(source && span.text_hash === source.textHash, 'Citation source/hash mismatch');
      ensure(Number.isSafeInteger(span.start) && Number.isSafeInteger(span.end) && span.start >= 0 && span.end > span.start && encoder.encode(citation.text).length === span.end - span.start, 'Context excerpt byte length mismatch');
      ensure(assertion.evidence.some(e => e.source === span.source && e.text_hash === span.text_hash && e.start === span.start && e.end === span.end), 'Citation is not bound to assertion evidence');
      const ev: Evidence = { sourceId: span.source, title: citation.title, quote: citation.text, start: span.start, end: span.end, textHash: span.text_hash, locator: span.locator || undefined, url: source.url, license: citation.license, date: source.date, verification: 'context-excerpt-only' };
      const passageId = `${span.source}:${span.start}-${span.end}`;
      const existing = passages.get(passageId);
      ensure(!existing || existing.evidence[0].quote === citation.text, 'Conflicting text for identical evidence span');
      if (!existing) {
        const passage = node('passage', passageId, citation.text, [span.source], [ev], { date: source.date, metadata: { structure: 'Exact quoted span from native context', perspective: source.perspective || 'unknown' } });
        passages.set(passageId, passage); nodes.push(passage);
        appendEdge(key('document', span.source), passage.id, 'contains', 'contains quoted evidence span');
      }
      appendEdge(key('passage', passageId), key('claim', id), 'evidence_for', 'supplies quoted evidence for');
      return ev;
    });
    const sourceIds = Array.from(new Set(citations.map(c => c.sourceId)));
    const perspective = sourceIds.some(id => sources.get(id)?.perspective === 'retrospective') ? 'retrospective' : sourceIds.every(id => sources.get(id)?.perspective === 'contemporary') ? 'contemporary' : 'unknown';
    const date = citations.every(c => c.date && JSON.stringify(c.date) === JSON.stringify(citations[0].date)) ? citations[0].date : undefined;
    const claim = node('claim', id, assertion.proposition, sourceIds, citations, { date, conditions: assertion.conditions, exceptions: assertion.exceptions, uncertainty: value.temporal_status[id] || 'Historical applicability is unverified.', metadata: { perspective, knowledge: layer.knowledge, speaker: assertion.speaker, subject: assertion.subject, predicate: assertion.predicate, modality: assertion.modality, epistemicType: assertion.epistemic_type, observedAt: value.observed_at[id] == null ? 'Unknown' : String(value.observed_at[id]), dateBasis: 'Source-document date; not inferred event validity' } });
    claims.set(id, claim); nodes.push(claim);
  }
  for (const [id, entity] of Object.entries(value.context.entities)) {
    ensure(id === entity.id && ['actor', 'institution', 'event'].includes(entity.kind) && entity.claims.length > 0, 'Invalid context entity');
    const associated = entity.claims.map(id => { const claim = claims.get(id); ensure(claim, 'Entity references omitted assertion'); return claim; });
    const perspective = associated.some(c => c.metadata.perspective === 'retrospective') ? 'retrospective' : associated.every(c => c.metadata.perspective === 'contemporary') ? 'contemporary' : 'unknown';
    const n = node(entity.kind, id, entity.label, Array.from(new Set(associated.flatMap(c => c.sourceIds))), [], { metadata: { perspective, annotationEventTime: entity.event_time == null ? 'Unknown' : String(entity.event_time) } });
    nodes.push(n);
    for (const claim of associated) appendEdge(n.id, claim.id, 'annotated_in', 'associated by unreviewed annotation');
  }
  for (const link of value.context.relationships) {
    ensure(claims.has(link.from) && claims.has(link.to) && ['contradicts', 'supersedes', 'depends_on'].includes(link.kind), 'Relationship references omitted assertion');
    appendEdge(key('claim', link.from), key('claim', link.to), link.kind, `unreviewed ${link.kind.replace('_', ' ')} annotation`, link.rationale);
  }
  const ids = new Set<string>();
  for (const n of nodes) { ensure(!ids.has(n.id), 'Duplicate context graph identity'); ids.add(n.id); n.searchText = [n.label, n.kind, ...n.sourceIds, ...n.conditions, ...n.exceptions, ...Object.values(n.metadata)].join(' ').toLowerCase(); }
  ensure(nodes.length <= 100000 && edges.length <= 200000, 'Context graph exceeds browser projection bound');
  return { id: value.manifest.id, title: value.manifest.title, synthetic, nodes, edges, documents, warnings: [...value.context.warnings, ...value.manifest.limitations, `Context contains ${Object.keys(value.context.omissions).length} omitted assertions.`, `Archive digest: ${value.archive_digest}`, `Native query known_as_of: ${value.context.known_as_of}; valid_at: ${value.context.valid_at}. These numeric core checkpoints are not automatically source-document dates.`, 'Source-document dates are separate from knowledge-as-of and world validity.', 'Context excerpts are not full source text; the UI checks byte lengths, not the full source hash.'] };
}
