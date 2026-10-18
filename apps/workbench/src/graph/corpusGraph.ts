import { buildEvidenceGraph, safeSourceUrl } from './evidenceGraph';
import type { EvidenceGraph, GraphNode, SourceDate, SourceDocument, SourcePresentation } from './evidenceGraph';
export type CorpusIndex = {
  format: 'tacitus-source-corpus-index/1'; title: string; scope: string; transform: string;
  document_count: number; structural_blocks: number;
  documents: { id: string; title: string; text: string; text_sha256: string; text_bytes: number;
    source_kind: string; document_date: string | null; document_date_raw?: string | null; url: string; rights_id: string; rights_url: string;
    edition_publication_year?: number; edition_year_note?: string; composition_period?: string; historical_availability_warning?: string; received_raw?: string | null;
    source_marked_entities: { entity_id: string; label: string; surface: string; role: string | null; annotation_origin: string }[];
    blocks: NonNullable<SourceDocument['blocks']>;
  }[];
};
function sourceDate(document: CorpusIndex['documents'][number]): SourceDate | undefined {
  if (!document.document_date) {
    const composition = /^(\d{4})-(\d{2})$/.exec(document.composition_period || '');
    if (composition) return { label: document.document_date_raw || `Composed ${document.composition_period}`, year: +composition[1], month: +composition[2], precision: 'month' };
    return document.document_date_raw ? { label: document.document_date_raw, precision: 'unknown' } : undefined;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(document.document_date);
  if (match) return { label: document.document_date_raw || document.document_date, year: +match[1], month: +match[2], day: +match[3], precision: 'day', calendar: 'Gregorian' };
  const year = /^\d{4}$/.test(document.document_date) ? Number(document.document_date) : undefined;
  return { label: document.document_date_raw || document.document_date, year, precision: year ? 'year' : 'unknown' };
}
function presentation(document: CorpusIndex['documents'][number]): SourcePresentation {
  return { url: safeSourceUrl(document.url), date: sourceDate(document), perspective: document.source_kind === 'contemporaneous_dispatch_in_later_edition' ? 'contemporary' : document.source_kind === 'retrospective_memoir_section' ? 'retrospective' : 'unknown' };
}
export function presentationFromCorpus(index: CorpusIndex): Record<string, SourcePresentation> {
  return Object.fromEntries(index.documents.map(d => [`${d.id}@1`, presentation(d)]));
}
/** Publisher-marked people and structural blocks, never automatic semantic assertions. */
export async function graphFromCorpus(index: CorpusIndex): Promise<EvidenceGraph> {
  if (index.format !== 'tacitus-source-corpus-index/1' || index.documents.length !== index.document_count) throw new Error('Invalid corpus index or document count');
  const documents: SourceDocument[] = index.documents.map(d => ({ id: d.id, title: d.title, text: d.text, textHash: d.text_sha256, license: `${d.rights_id} — ${d.rights_url}`, blocks: d.blocks, ...presentation(d) }));
  const graph = await buildEvidenceGraph({ id: 'july-1914-documentary-atlas-v1', title: index.title, documents });
  const people = new Map<string, GraphNode>();
  for (const document of index.documents) {
    const sourceNode = graph.nodes.find(n => n.id === `document:${document.id}`)!;
    sourceNode.metadata.editionPublicationYear = document.edition_publication_year ? String(document.edition_publication_year) : 'Not supplied';
    sourceNode.metadata.editionYearNote = document.edition_year_note || 'Not supplied';
    if (document.source_kind === 'retrospective_memoir_section') sourceNode.metadata.rightsNotice = 'Project Gutenberg declares public domain in the USA. Other jurisdictions are not assessed. Retain the Gutenberg license and notices with redistribution.';
    sourceNode.metadata.receipt = document.received_raw || 'Receipt date/time not supplied';
    sourceNode.metadata.availability = document.historical_availability_warning || 'Document date is not proof of receipt or access.';
    const seen = new Set<string>();
    for (const entity of document.source_marked_entities) {
      const id = `actor:${entity.entity_id}`;
      let person = people.get(id);
      if (!person) {
        person = { id, kind: 'actor', label: entity.label, sourceIds: [], evidence: [], uncertainty: 'Identity comes from publisher TEI person markup. This is not an independently reviewed historical identity resolution.', conditions: [], exceptions: [], metadata: { perspective: presentation(document).perspective || 'unknown', origin: entity.annotation_origin, authorityId: entity.entity_id }, searchText: `${entity.label} ${entity.surface} actor publisher TEI`.toLowerCase() };
        people.set(id, person);
      }
      if (!person.sourceIds.includes(document.id)) person.sourceIds.push(document.id);
      const signature = `${id}:${entity.role || 'mentioned'}`;
      if (seen.has(signature)) continue; seen.add(signature);
      graph.edges.push({ id: `edge:${graph.edges.length}`, from: id, to: `document:${document.id}`, kind: 'source_marked', label: entity.role ? `publisher-marked person; role: ${entity.role}` : 'publisher-marked person in source', rationale: entity.annotation_origin });
    }
  }
  graph.nodes.push(...people.values());
  const passages = graph.nodes.filter(n => n.kind === 'passage').length;
  if (passages !== index.structural_blocks) throw new Error('Structural block count differs from index');
  graph.warnings.push(index.scope, index.transform, 'Contemporary dispatches are reproduced in a later public edition. Source-date playback is not historical recipient availability.', 'Lichnowsky memoir sections are retrospective and are excluded by the default contemporary-source filter.', `${passages} structural blocks include headings, datelines, paragraphs and signatures. They are not ${passages} extracted facts.`);
  return graph;
}
