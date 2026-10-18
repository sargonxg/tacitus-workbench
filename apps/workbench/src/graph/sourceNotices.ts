export const LICHNOWSKY_FAMILY = 'lichnowsky-gutenberg-39457-english';
export type SourceNoticeRecord = { source_family?: string; family?: string; license?: string; perspective?: string };

/** Imported declarations choose a notice, never a work identity inferred from a license substring. */
export function sourceNoticeFlags(records: SourceNoticeRecord[]) {
  const lichnowsky = (source: SourceNoticeRecord) => (source.source_family ?? source.family) === LICHNOWSKY_FAMILY;
  return {
    lichnowsky: records.some(lichnowsky),
    otherGutenberg: records.some(source => !lichnowsky(source) && /Gutenberg/i.test(source.license ?? '')),
    retrospective: records.some(source => source.perspective === 'retrospective'),
  };
}
