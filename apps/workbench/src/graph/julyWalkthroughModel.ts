import { quoteFromUtf8, safeSourceUrl, sha256Text } from './evidenceGraph';
import type { NativeCapture, NativeContext } from './evidenceGraph';
import type { CorpusIndex } from './corpusGraph';

export type TemporalLens = 'source-created' | 'recipient-received' | 'explicit-hindsight-comparison';
export type GuidedQuestion = { id: string; question: string; historical_cutoff?: string; basis: TemporalLens; useful_claims: string[]; must_preserve: string[]; must_exclude?: string[]; };
export type DetailedSource = CorpusIndex['documents'][number] & { recipient_received_calendar_date: string | null; recipient_receipt_precision?: string; dateline_raw?: string | null; historical_availability_warning?: string; };
export type WalkthroughSource = { id: string; title: string; url?: string; kind: string; documentDate: string | null; documentDateLabel: string | null; receivedDate: string | null; receivedLabel: string | null; compositionPeriod: string | null; editionYear: number | null; rights: string; hash: string; };
export type BoundQuote = { sourceId: string; sourceKey: string; start: number; end: number; hash: string; locator: string | null; text: string; };
export type WalkthroughClaim = { id: string; text: string; speaker: string; subject: string; predicate: string; epistemicType: string; modality: string; conditions: string[]; exceptions: string[]; quotes: BoundQuote[]; dependencies: string[]; eventDate: string | null; eventPrecision: string; kind: 'source-interpretation' | 'cross-source-synthesis'; retrospective: boolean; };
export type RecordedRun = { id: string; query: string; request: { question: string; known_as_of: number; valid_at: number; time_mode: string; max_bytes: number; revoked_sources: string[] }; sourceIds: string[]; archiveDigest: string; coreRevision: string; selectedClaimIds: string[]; omissions: Record<string, string>; outputBytes: number; outputSha256: string; context: NativeContext; };
export type ComparisonArm = { label: string; revision: string; codeSha256: string; archiveDigest: string; question: string; maxBytes: number; knownAsOf: number; validAt: number; timeMode: string; revokedSources: string[]; sourceIds: string[]; selectedClaimIds: string[]; omissions: Record<string, string>; outputBytes: number; outputSha256: string; excerptCount: number; coveredClaimEvidence: string[]; includesAuthoredAnnotations: boolean; omissionUnit: 'source' | 'claim'; coverageMeaning: string; selectedSourceIds: string[]; excerpts: { source: string; start: number; end: number; text_hash: string; quote: string }[]; durationMs?: number; };
export type RetrievalComparison = { id: string; measuredAt: string | null; receiptSha256: string; experiment: string; left: ComparisonArm; right: ComparisonArm; interpretation: string; limitations: string[]; };
export type WalkthroughData = {
  format: 'tacitus-july-walkthrough/1'; title: string;
  provenance: { repositoryUrl: string; exampleRevision: string; archiveDigest: string; corpusSha256: string; captureSha256: string; };
  counts: { corpusRecords: number; structuralBlocks: number; publisherPeople: number; structuralGraphNodes: number; nativeSourceRecords: number; authoredClaims: number; typedEntities: number; authoredLinks: number; retrospectiveRecords: number; };
  sources: WalkthroughSource[]; claims: WalkthroughClaim[]; entities: NativeCapture['graph']['nodes']; links: NativeCapture['graph']['links']; questions: GuidedQuestion[];
  recordedRuns: RecordedRun[]; comparisons: RetrievalComparison[]; limitations: string[];
};
function requireValue(ok: unknown, reason: string): asserts ok { if (!ok) throw new Error(reason); }
const compareLists = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
export const JULY_MATCHED_RECEIPT_SHA256 = '58cfa53514347ca1cfa82ba8a4ecab63b334687f36294b267e100a22e77b5cdd';
export function assertMatchedComparison(comparison: RetrievalComparison): void {
  const { left: a, right: b } = comparison;
  requireValue(comparison.receiptSha256 === JULY_MATCHED_RECEIPT_SHA256, 'Comparison receipt is not the frozen reviewed July receipt');
  requireValue(a.archiveDigest === b.archiveDigest && /^[a-f0-9]{64}$/.test(a.archiveDigest), 'Comparison archive/source bytes do not match');
  requireValue(a.question === b.question && a.maxBytes === b.maxBytes, 'Comparison question or budget does not match');
  requireValue(a.knownAsOf === b.knownAsOf && a.validAt === b.validAt && a.timeMode === b.timeMode, 'Comparison temporal conditions do not match');
  requireValue(compareLists(a.sourceIds, b.sourceIds) && compareLists(a.revokedSources, b.revokedSources), 'Comparison source selection or revocations do not match');
  for (const arm of [a, b]) {
    requireValue(Boolean(arm.revision) && /^[a-f0-9]{64}$/.test(arm.codeSha256) && /^[a-f0-9]{64}$/.test(arm.outputSha256), 'Comparison must pin actual code and output bytes');
    requireValue(Number.isInteger(arm.outputBytes) && arm.outputBytes >= 0 && arm.outputBytes <= arm.maxBytes, 'Comparison output byte count is outside its cap');
    requireValue(new Set(arm.selectedClaimIds).size === arm.selectedClaimIds.length, 'Duplicate selected claims in measured arm');
    requireValue(new Set(arm.sourceIds).size === arm.sourceIds.length && arm.sourceIds.length > 0, 'Comparison source inventory must be unique and nonempty');
    requireValue(arm.excerptCount === arm.excerpts.length && arm.selectedSourceIds.every(id => arm.sourceIds.includes(id)), 'Comparison excerpt inventory is inconsistent');
    requireValue(arm.excerpts.every(quote => arm.selectedSourceIds.includes(quote.source)), 'Comparison excerpt source is not selected');
    requireValue(arm.includesAuthoredAnnotations || arm.selectedClaimIds.length === 0, 'Source-only baseline cannot claim authored annotations');
    requireValue(!arm.includesAuthoredAnnotations || compareLists(arm.coveredClaimEvidence, arm.selectedClaimIds), 'Annotation retention differs from selected authored records');
  }
}
export function compareRetrieval(comparison: RetrievalComparison) {
  assertMatchedComparison(comparison);
  const left = new Set(comparison.left.coveredClaimEvidence), right = new Set(comparison.right.coveredClaimEvidence);
  return { shared: [...left].filter(id => right.has(id)), leftOnly: [...left].filter(id => !right.has(id)), rightOnly: [...right].filter(id => !left.has(id)) };
}
export async function buildWalkthroughData(input: {
  corpus: Omit<CorpusIndex, 'documents'> & { documents: DetailedSource[] }; capture: NativeCapture;
  historical: { claims: { claim_id: string; source_id: string; event_date: string | null; event_date_precision: string }[] };
  questions: { questions: GuidedQuestion[] }; provenance: WalkthroughData['provenance']; recordedRuns?: RecordedRun[]; comparisons?: RetrievalComparison[];
}): Promise<WalkthroughData> {
  const { corpus, capture } = input;
  requireValue(corpus.format === 'tacitus-source-corpus-index/1', 'Unsupported corpus');
  requireValue(/^[a-f0-9]{40}$/.test(input.provenance.exampleRevision), 'Example must be revision pinned');
  const corpusSources = new Map(corpus.documents.map(d => [d.id, d]));
  requireValue(corpusSources.size === corpus.documents.length, 'Duplicate corpus source');
  const nativeSources = new Map<string, DetailedSource>();
  for (const source of capture.documents) {
    const document = corpusSources.get(source.id);
    requireValue(document && document.text === source.text && document.text_sha256 === source.text_hash, 'Capture source differs from corpus');
    requireValue(await sha256Text(document.text) === document.text_sha256, 'Source hash failed');
    const key = `${source.id}@${source.version}`;
    requireValue(!nativeSources.has(key), 'Duplicate native source'); nativeSources.set(key, document);
  }
  const sources: WalkthroughSource[] = corpus.documents.map(d => ({ id: d.id, title: d.title, url: safeSourceUrl(d.url), kind: d.source_kind, documentDate: d.document_date, documentDateLabel: d.document_date_raw || null, receivedDate: d.recipient_received_calendar_date || null, receivedLabel: d.received_raw || null, compositionPeriod: d.composition_period || null, editionYear: d.edition_publication_year || null, rights: d.rights_id, hash: d.text_sha256 }));
  const ids = new Set(capture.assertions.map(a => a.id));
  requireValue(ids.size === capture.assertions.length, 'Duplicate authored assertion');
  for (const [id, entity] of Object.entries(capture.graph.nodes)) requireValue(id === entity.id && entity.claims.every(claimId => ids.has(claimId)), 'Invalid entity annotation');
  for (const link of capture.graph.links) requireValue(ids.has(link.from) && ids.has(link.to), 'Dangling authored link');
  const claims: WalkthroughClaim[] = capture.assertions.map(assertion => {
    const quotes = assertion.evidence.map(span => {
      const document = nativeSources.get(span.source);
      requireValue(document && span.text_hash === document.text_sha256, 'Evidence references unknown source or hash');
      return { sourceId: document.id, sourceKey: span.source, start: span.start, end: span.end, hash: span.text_hash, locator: span.locator || null, text: quoteFromUtf8(document.text, span.start, span.end) };
    });
    requireValue(quotes.length > 0, 'Authored claim has no source evidence');
    const dependencies = capture.graph.links.filter(l => l.from === assertion.id && l.kind === 'depends_on').map(l => l.to);
    const historical = input.historical.claims.find(c => c.claim_id === assertion.id);
    return { id: assertion.id, text: assertion.proposition, speaker: assertion.speaker, subject: assertion.subject, predicate: assertion.predicate, epistemicType: assertion.epistemic_type, modality: assertion.modality, conditions: assertion.conditions, exceptions: assertion.exceptions, quotes, dependencies, eventDate: historical?.event_date || null, eventPrecision: historical?.event_date_precision || 'unknown', kind: dependencies.length ? 'cross-source-synthesis' : 'source-interpretation', retrospective: quotes.some(q => corpusSources.get(q.sourceId)?.source_kind === 'retrospective_memoir_section') };
  });
  for (const question of input.questions.questions) for (const id of question.useful_claims) requireValue(ids.has(id), `Guided question references unknown claim ${id}`);
  for (const run of input.recordedRuns || []) {
    requireValue(run.archiveDigest === input.provenance.archiveDigest && run.context.archive_digest === input.provenance.archiveDigest, 'Recorded query has different archive');
    requireValue(run.query === run.request.question && run.query === run.context.context.question, 'Recorded query text mismatch');
    requireValue(compareLists(run.selectedClaimIds, Object.keys(run.context.context.claims)), 'Recorded selected IDs do not match the native output');
    requireValue(run.selectedClaimIds.every(id => ids.has(id)), 'Recorded query selects unknown claim');
    requireValue(run.outputBytes <= run.request.max_bytes, 'Recorded output exceeds budget');
    for (const layer of Object.values(run.context.context.claims)) {
      requireValue(JSON.stringify(layer.assertion) === JSON.stringify(capture.assertions.find(a => a.id === layer.assertion.id)), 'Recorded authored annotation differs from capture');
      requireValue(layer.citations.length === layer.assertion.evidence.length && layer.assertion.evidence.every(span => layer.citations.some(q => JSON.stringify(q.span) === JSON.stringify(span))), 'Recorded context omits original evidence');
      for (const citation of layer.citations) {
        const document = nativeSources.get(citation.span.source);
        requireValue(document && document.text_sha256 === citation.span.text_hash && quoteFromUtf8(document.text, citation.span.start, citation.span.end) === citation.text, 'Recorded citation differs from corpus');
      }
    }
  }
  for (const comparison of input.comparisons || []) {
    assertMatchedComparison(comparison);
    requireValue(comparison.left.archiveDigest === input.provenance.archiveDigest && compareLists(comparison.left.sourceIds, [...nativeSources.keys()]), 'Comparison is from a different capsule');
    requireValue([...comparison.left.selectedClaimIds, ...comparison.right.selectedClaimIds, ...comparison.left.coveredClaimEvidence, ...comparison.right.coveredClaimEvidence].every(id => ids.has(id)), 'Comparison selects unknown claim');
    for (const arm of [comparison.left, comparison.right]) for (const quote of arm.excerpts) {
      const document = nativeSources.get(quote.source);
      requireValue(document && document.text_sha256 === quote.text_hash && quoteFromUtf8(document.text, quote.start, quote.end) === quote.quote, 'Comparison quote differs from source bytes');
    }
    for (const arm of [comparison.left, comparison.right]) {
      if (arm.includesAuthoredAnnotations) {
        const run = input.recordedRuns?.find(r => r.outputSha256 === arm.outputSha256);
        requireValue(run && compareLists(run.selectedClaimIds, arm.selectedClaimIds), 'Annotation retention needs a matching verified native context');
        const expectedQuotes = Object.values(run.context.context.claims).flatMap(layer => layer.citations.map(q => ({ source: q.span.source, start: q.span.start, end: q.span.end, text_hash: q.span.text_hash, quote: q.text })));
        requireValue(JSON.stringify(arm.excerpts) === JSON.stringify(expectedQuotes), 'Native comparison quotes differ from verified context');
      } else {
        const contained = claims.filter(claim => claim.quotes.every(q => arm.excerpts.some(e => e.source === q.sourceKey && e.text_hash === q.hash && e.start <= q.start && e.end >= q.end))).map(claim => claim.id);
        requireValue(compareLists(contained, arm.coveredClaimEvidence), 'Post-hoc span containment differs from exact evidence');
      }
    }
  }
  const people = new Set(corpus.documents.flatMap(d => d.source_marked_entities.map(e => e.entity_id)));
  return { format: 'tacitus-july-walkthrough/1', title: 'July 1914: what the evidence lets us say', provenance: input.provenance, counts: { corpusRecords: corpus.documents.length, structuralBlocks: corpus.structural_blocks, publisherPeople: people.size, structuralGraphNodes: corpus.documents.length + corpus.structural_blocks + people.size, nativeSourceRecords: capture.documents.length, authoredClaims: claims.length, typedEntities: Object.keys(capture.graph.nodes).length, authoredLinks: capture.graph.links.length, retrospectiveRecords: corpus.documents.filter(d => d.source_kind === 'retrospective_memoir_section').length }, sources, claims, entities: capture.graph.nodes, links: capture.graph.links, questions: input.questions.questions, recordedRuns: input.recordedRuns || [], comparisons: input.comparisons || [], limitations: [...(capture.manifest.limitations || []), 'Guided questions and interpretations are authored teaching examples, not held-out evaluation.', 'No generated model answers, factual-answer score or measured answer-quality improvement are supplied.', 'Structural graph counts are separate from unreviewed semantic annotations.', 'FRUS excerpts preserve printed editorial bracket corrections in a later edited edition; these normalized texts are not original telegram facsimiles.', 'Historical clock filtering below is a display reconstruction; it does not mutate native known_as_of or valid_at.'] };
}
export function validCalendarDay(day: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day); if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), value = Number(match[3]); const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0); const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month > 0 && month <= 12 && value > 0 && value <= days[month - 1];
}
export function selectHistoricalClaims(data: WalkthroughData, lens: TemporalLens, cutoff: string) {
  requireValue(['source-created', 'recipient-received', 'explicit-hindsight-comparison'].includes(lens), 'Unknown historical clock');
  requireValue(lens === 'explicit-hindsight-comparison' || validCalendarDay(cutoff), 'A calendar cutoff is required');
  const sources = new Map(data.sources.map(s => [s.id, s]));
  const selected: string[] = [], withheld: Record<string, string[]> = {};
  for (const claim of data.claims) {
    const reasons = new Set<string>();
    if (lens !== 'explicit-hindsight-comparison') for (const quote of claim.quotes) {
      const source = sources.get(quote.sourceId); requireValue(source, 'Claim source is missing');
      if (source.kind === 'retrospective_memoir_section') { reasons.add(`${source.id}: composed after 1914; retrospective memoir excluded`); continue; }
      const date = lens === 'source-created' ? source.documentDate : source.receivedDate;
      if (!date || !validCalendarDay(date)) reasons.add(`${source.id}: calendar date unknown for ${lens}; time-only wording is insufficient`);
      else if (date > cutoff) reasons.add(`${source.id}: ${date} is later than ${cutoff}`);
    }
    if (reasons.size) withheld[claim.id] = [...reasons]; else selected.push(claim.id);
  }
  return { selected, withheld };
}
export const JOURNEY_INTERPRETATIONS: Record<string, { title: string; notice: string; helps: string }> = {
  'outlook-july27': { title: 'Uncertainty before the outcome', notice: 'The same cutoff contains hopeful, pessimistic and conditional assessments. Their disagreement does not supply a calibrated probability of war.', helps: 'A source-bound context can keep attribution, recording date and unknown Russian intentions beside the forecast. Whether a model uses these correctly still requires an answer evaluation.' },
  'gerard-change': { title: 'A forecast can change', notice: 'Gerard’s dated outlook changes between July 27 and July 30. This is not a timeless contradiction, and these records alone do not establish why his view changed.', helps: 'The authored dependency links keep both dated observations with the comparison, making its basis inspectable.' },
  'mobilization-precision': { title: 'Mobilization is not one unqualified event', notice: 'The sources distinguish an order, ongoing activity and the decree’s public promulgation. Preserve the later clarification and the printed editorial bracket.', helps: 'The context can carry the qualifying passage with the earlier claim rather than flattening both into one date. This is a preservation mechanism, not a measured answer-quality gain.' },
  'good-offices': { title: 'Inquiry, approach and offer', notice: 'An inquiry about acceptability, an informal approach and a presidential offer are different speech acts. None alone proves acceptance or diplomatic success.', helps: 'Typed claims preserve the actor and modality. Charles Stetson Wilson and President Woodrow Wilson must remain distinct people.' },
  'receipt-delays': { title: 'Four clocks, different questions', notice: 'Source creation, recipient receipt, event date and modern corpus ingestion answer different questions. Cross-zone calendar dates and time-only receipts must not be repaired by guesswork.', helps: 'The clock selector makes exclusions explicit. Receipt establishes neither reading nor belief.' },
  'qualification-survival': { title: 'Keep the qualification attached', notice: 'Conditional convention compliance, unverified reports and unconfirmed rumors should retain those labels. An official state-of-war note does not verify unrelated operational rumors.', helps: 'Conditions, exceptions and attributed uncertainty remain visible beside the exact quote, providing a checklist for a future generated answer.' },
  'hindsight-separated': { title: 'A later memoir is another perspective', notice: 'Lichnowsky’s retrospective, potentially self-justifying account was composed in August 1916. It can be compared with contemporary records only as explicitly enabled hindsight.', helps: 'Source composition metadata prevents the memoir from silently entering a 1914 reconstruction.' },
  'scope-language-and-conflict': { title: 'Inspect a discrepancy without resolving it', notice: 'July 31 in the memoir and August 1 in Wilson’s telegram are different date attributions. Issuing a declaration and presenting it may need distinction; the proposed link does not establish deceit.', helps: 'Exact spans expose the disputed language and preserve the question-versus-proposal and neutrality-scope distinctions for review.' }
};
