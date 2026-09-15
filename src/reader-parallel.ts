import type { ReaderSettings } from './reader-settings';

/** Edition side, never language, identifies a simplified/original companion. */
export function parallelScript(fluent: string, mode: ReaderSettings['parallel']) {
  if (mode === 'off') return '';
  return `
    (function () {
      var fluent = ${JSON.stringify(fluent.toUpperCase())};
      function isFluent(seg) {
        var side = seg.getAttribute('data-side');
        return side ? side === 'secondary' : (seg.getAttribute('lang') || '').toUpperCase() === fluent;
      }
      document.querySelectorAll('span.seg-pair').forEach(function (pair) {
        pair.querySelectorAll('span.segment').forEach(function (seg) {
          seg.classList.add(isFluent(seg) ? 'almonium-fluent' : 'almonium-target');
        });
      });
      ${mode === 'inline' ? `
        document.querySelectorAll('p, h2, h3, blockquote, div.poem').forEach(function (block) {
          var segments = block.querySelectorAll('.almonium-fluent');
          if (!segments.length) return;
          var translation = document.createElement('p');
          translation.className = 'almonium-inline';
          segments.forEach(function (seg) { translation.appendChild(seg); translation.appendChild(document.createTextNode(' ')); });
          block.parentNode.insertBefore(translation, block.nextSibling);
        });` : ''}
      document.addEventListener('click', function (event) {
        var selection = window.getSelection();
        if (selection && selection.toString().trim()) return;
        if (!event.target || !event.target.closest) return;
        var pair = event.target.closest('span.seg-pair');
        ${mode === 'on-demand' ? "if (pair) pair.classList.toggle('almonium-open');" : ''}
        var hit = event.target.closest('[data-alignment]');
        if (!hit) return;
        var id = hit.getAttribute('data-alignment');
        document.querySelectorAll('[data-alignment]').forEach(function (span) {
          span.classList.toggle('almonium-aligned-active', span.getAttribute('data-alignment') === id);
        });
      });
    })();
  `;
}
