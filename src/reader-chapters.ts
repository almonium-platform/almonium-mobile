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
  return `(function () { var node = (window.__almoniumChapters || [])[${index}]; if (node) { window.__almoniumScrollReset = true; node.scrollIntoView({block: 'start'}); } })(); true;`;
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

const cefrOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * Sources shout their headings ("CHAPTER V."); the rails and the chapter header show them as
 * "Chapter V". Display only: the anchor and the heading in the text keep the source's form.
 */
export function displayChapterTitle(title: string) {
  const trimmed = title.trim().replace(/[.\s]+$/, '');
  if (!trimmed || /\p{Ll}/u.test(trimmed)) return trimmed;
  return trimmed.split(/(\s+)/).map(part =>
    /^[IVXLCDM]+$/.test(part) || /^\s+$/.test(part) ? part
      : part.charAt(0).toLocaleUpperCase() + part.slice(1).toLocaleLowerCase()).join('');
}

/** "B1–C1" over the body chapters with a complete estimate; null when nothing is estimated. */
export function chapterLevelRange(chapters: ReaderChapter[], data: ChapterEnrichment[] = []) {
  const ranks = chapters.flatMap(chapter => {
    const level = chapterEnrichment(chapter, data)?.cefrEstimate;
    return level ? [cefrOrder.indexOf(level)] : [];
  });
  if (!ranks.length) return null;
  const low = cefrOrder[Math.min(...ranks)];
  const high = cefrOrder[Math.max(...ranks)];
  return low === high ? low : `${low}–${high}`;
}

/** Sequence for "Chapter n of N": the processor anchor when present, else the heading's place. */
export function chapterNumber(chapter: ReaderChapter) {
  const sequence = /^chapter-(\d+)$/.exec(chapter.anchor)?.[1];
  return sequence ? Number(sequence) : chapter.index + 1;
}

/** Runs after discovery. Reports the chapter holding the viewport and whether the chrome should show. */
export const positionScript = `
  (function () {
    var lastChapter = -2, lastShown = true, anchorY = window.scrollY, ticking = false;
    function measure() {
      ticking = false;
      var y = window.scrollY;
      var nodes = window.__almoniumChapters || [];
      var chapter = -1;
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].getBoundingClientRect().top <= 140) chapter = i; else break;
      }
      var shown = lastShown;
      if (window.__almoniumScrollReset) { window.__almoniumScrollReset = false; anchorY = y; shown = true; }
      else if (y < 48) { shown = true; anchorY = y; }
      else if (Math.abs(y - anchorY) > 28) { shown = y < anchorY; anchorY = y; }
      if (chapter === lastChapter && shown === lastShown) return;
      lastChapter = chapter; lastShown = shown;
      window.ReactNativeWebView.postMessage(JSON.stringify({type: 'position', chapter: chapter, chrome: shown}));
    }
    function schedule() { if (!ticking) { ticking = true; requestAnimationFrame(measure); } }
    document.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('load', schedule);
    setTimeout(schedule, 400);
  })();
`;

export interface ChapterHeader {
  index: number;
  meta: string;
  description: string;
}

/** Puts the chapter's mono line and description under its heading. Text only; the source HTML is never re-parsed. */
export function chapterHeaderScript(headers: ChapterHeader[]) {
  const safe = headers.filter(header => Number.isInteger(header.index) && header.index >= 0 && header.index < 5000)
    .map(header => ({ index: header.index, meta: String(header.meta).slice(0, 200), description: String(header.description).slice(0, 2000) }));
  return `(function () {
    var headers = ${JSON.stringify(safe)};
    var nodes = window.__almoniumChapters || [];
    document.querySelectorAll('.almonium-chapter-head').forEach(function (node) { node.remove(); });
    headers.forEach(function (header) {
      var heading = nodes[header.index];
      if (!heading || !heading.parentNode) return;
      var block = document.createElement('div');
      block.className = 'almonium-chapter-head';
      if (header.meta) { var meta = document.createElement('div'); meta.className = 'almonium-chapter-meta'; meta.textContent = header.meta; block.appendChild(meta); }
      if (header.description) { var copy = document.createElement('p'); copy.className = 'almonium-chapter-desc'; copy.textContent = header.description; block.appendChild(copy); }
      heading.parentNode.insertBefore(block, heading.nextSibling);
    });
  })(); true;`;
}

export interface ChapterEndBlock {
  index: number;
  title: string;
  note: string;
  words: { lemma: string; surface: string; context: string; blockId: string }[];
  shown: number;
  allLabel: string;
  next: { index: number; meta: string; title: string; description: string } | null;
}

/**
 * The chapter end: the chapter's words, then the next chapter. Inserted before the next heading,
 * or after the last text for the final chapter. A word row posts back; the next row scrolls locally.
 */
export function chapterEndScript(block: ChapterEndBlock) {
  if (!Number.isInteger(block.index) || block.index < 0 || block.index >= 5000) return 'true;';
  const safe: ChapterEndBlock = {
    index: block.index,
    title: String(block.title).slice(0, 200),
    note: String(block.note).slice(0, 300),
    words: block.words.slice(0, 500).map(word => ({
      lemma: String(word.lemma).slice(0, 200), surface: String(word.surface).slice(0, 200),
      context: String(word.context).slice(0, 1000), blockId: String(word.blockId).slice(0, 200),
    })),
    shown: Math.max(0, Math.min(50, Math.floor(block.shown))),
    allLabel: String(block.allLabel).slice(0, 200),
    next: block.next && Number.isInteger(block.next.index) && block.next.index >= 0 && block.next.index < 5000 ? {
      index: block.next.index, meta: String(block.next.meta).slice(0, 200),
      title: String(block.next.title).slice(0, 200), description: String(block.next.description).slice(0, 2000),
    } : null,
  };
  return `(function () {
    var block = ${JSON.stringify(safe)};
    var nodes = window.__almoniumChapters || [];
    var heading = nodes[block.index];
    if (!heading) return;
    var existing = document.querySelector('.almonium-chapter-end[data-chapter="' + block.index + '"]');
    if (existing) existing.remove();
    var root = document.createElement('section');
    root.className = 'almonium-chapter-end';
    root.setAttribute('data-chapter', String(block.index));
    function el(tag, className, text, parent) {
      var node = document.createElement(tag); node.className = className; if (text) node.textContent = text; parent.appendChild(node); return node;
    }
    if (block.words.length) {
      var words = el('div', 'almonium-words', '', root);
      el('div', 'almonium-words-title', block.title, words);
      el('div', 'almonium-words-note', block.note, words);
      var list = el('div', 'almonium-words-list', '', words);
      block.words.forEach(function (word, position) {
        var row = el('button', 'almonium-word', '', list);
        row.type = 'button';
        if (position >= block.shown) row.style.display = 'none';
        var head = el('div', 'almonium-word-head', '', row);
        el('span', 'almonium-word-lemma', word.lemma, head);
        if (word.surface !== word.lemma) el('span', 'almonium-word-surface', word.surface, head);
        var excerpt = el('div', 'almonium-word-excerpt', '', row);
        var at = word.context.indexOf(word.surface);
        if (at < 0) excerpt.textContent = word.context;
        else {
          excerpt.appendChild(document.createTextNode(word.context.slice(0, at)));
          el('mark', '', word.surface, excerpt);
          excerpt.appendChild(document.createTextNode(word.context.slice(at + word.surface.length)));
        }
        row.addEventListener('click', function (event) {
          event.preventDefault();
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'chapter-word', chapter: block.index, blockId: word.blockId, lemma: word.lemma}));
        });
      });
      if (block.words.length > block.shown) {
        var all = el('button', 'almonium-words-all', block.allLabel, words);
        all.type = 'button';
        all.addEventListener('click', function (event) {
          event.preventDefault();
          list.querySelectorAll('.almonium-word').forEach(function (row) { row.style.display = ''; });
          all.remove();
        });
      }
    }
    if (block.next) {
      var next = el('button', 'almonium-next', '', root);
      next.type = 'button';
      el('div', 'almonium-next-meta', block.next.meta, next);
      el('div', 'almonium-next-title', block.next.title, next);
      if (block.next.description) el('div', 'almonium-next-desc', block.next.description, next);
      next.addEventListener('click', function (event) {
        event.preventDefault();
        var target = nodes[block.next.index];
        if (target) { window.__almoniumScrollReset = true; target.scrollIntoView({block: 'start'}); }
      });
    }
    var following = nodes[block.index + 1];
    if (following && following.parentNode) following.parentNode.insertBefore(root, following);
    else document.body.appendChild(root);
  })(); true;`;
}
