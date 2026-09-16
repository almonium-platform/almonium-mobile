export interface ReaderChapter {
  index: number;
  anchor: string;
  title: string;
}

export interface ChapterEnrichment {
  sequence: number;
  analysisStatus: string;
  cefrEstimate: string | null;
  descriptions: string[];
}

export function parseChapterEnrichments(value: unknown): ChapterEnrichment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (!Number.isInteger(row.sequence) || typeof row.analysisStatus !== 'string') return [];
    return [{
      sequence: row.sequence as number,
      analysisStatus: row.analysisStatus,
      cefrEstimate: typeof row.cefrEstimate === 'string' && /^(A1|A2|B1|B2|C1|C2)$/.test(row.cefrEstimate) ? row.cefrEstimate : null,
      descriptions: Array.isArray(row.descriptions) ? row.descriptions.filter((text): text is string => typeof text === 'string') : [],
    }];
  });
}

export function parseReaderChapters(value: unknown): ReaderChapter[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5000).flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (!Number.isInteger(row.index) || (row.index as number) < 0 || (row.index as number) >= 5000
      || typeof row.anchor !== 'string' || typeof row.title !== 'string') return [];
    return [{ index: row.index as number, anchor: row.anchor.slice(0, 300), title: row.title.slice(0, 300) }];
  });
}

export function chapterEnrichment(chapter: ReaderChapter, data: ChapterEnrichment[] = []) {
  // Only processor anchors have the published sequence contract. Never join by
  // array position: front matter and legacy headings can shift it.
  const sequence = /^chapter-(\d+)$/.exec(chapter.anchor)?.[1];
  return sequence ? data.find(row => row.sequence === Number(sequence) && row.analysisStatus === 'complete') : undefined;
}

export function chapterJumpScript(index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= 5000) return 'true;';
  return `(function () { var node = (window.__almoniumChapters || [])[${index}]; if (node) node.scrollIntoView({block: 'start'}); })(); true;`;
}

/** Runs after companion layout; keeps navigation entirely local when offline. */
export const chapterDiscoveryScript = `
  (function () {
    var headings = Array.from(document.querySelectorAll('.chapter-title'));
    if (!headings.length) headings = Array.from(document.querySelectorAll('h1, h2'));
    var seen = new Set();
    window.__almoniumChapters = headings.filter(function (node) {
      if (node.closest('[data-side="secondary"], .almonium-fluent, .sbs-column-secondary')) return false;
      if (node.id && seen.has(node.id)) return false;
      if (node.id) seen.add(node.id);
      return true;
    }).slice(0, 5000);
    var chapters = window.__almoniumChapters.map(function (node, index) {
      var primary = node.querySelector('[data-side="primary"]');
      return {index: index, anchor: node.id || '', title: (primary || node).textContent.trim().slice(0, 300)};
    });
    window.ReactNativeWebView.postMessage(JSON.stringify({type: 'chapters', chapters: chapters}));
  })();
`;
