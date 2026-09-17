import type { ParallelMode } from './reader-settings';

/**
 * The companion on the page (design L, mobile L6–L7). The parallel edition arrives as one
 * `span.seg-pair` per paragraph holding a primary and a secondary `span.segment`; certain sentence
 * groups are `span.aligned-sentence[data-alignment]` on both sides with the same id.
 *
 * Alignment is invisible until asked for: nothing is painted at rest. A tap lights the sentence
 * group under it (the tint), and in On demand the group's companion sentences open in a block
 * right after it, splitting the paragraph there; the tap on the same group, or elsewhere, closes
 * it. Inline puts every group's companion after it in the same flow, smaller and grey, and a tap
 * tints both halves. Where a paragraph has no groups the whole paragraph is the unit.
 *
 * The runtime stays on `window.__almoniumParallel` so a mode change never reloads the page.
 */
export function parallelScript(fluent: string, mode: ParallelMode, reduceMotion = false) {
  if (mode === 'off') return '';
  return `
    (function () {
      var fluent = ${JSON.stringify(fluent.toUpperCase())};
      var reduceMotion = ${reduceMotion ? 'true' : 'false'};
      var mode = ${JSON.stringify(mode)};
      var BLOCKS = 'p, h1, h2, h3, h4, blockquote, div.poem';
      var units = [];
      var state = { key: null, lit: [], demand: null };
      var lastSelectionAt = 0;

      function isSecondary(seg) {
        var side = seg.getAttribute('data-side');
        return side ? side === 'secondary' : (seg.getAttribute('lang') || '').toUpperCase() === fluent;
      }
      function validId(id) { return typeof id === 'string' && /^[\\w-]{1,64}$/.test(id); }
      function strip(node) {
        node.removeAttribute('data-alignment'); node.removeAttribute('role'); node.removeAttribute('tabindex'); node.removeAttribute('id');
        node.className = '';
      }
      /** A copy of companion text that is text only: no alignment ids, nothing to hit-test. */
      function cleanClone(node) {
        var copy = node.cloneNode(true);
        if (copy.nodeType !== 1) return copy;
        strip(copy);
        copy.querySelectorAll('[data-alignment], [id], [role]').forEach(strip);
        return copy;
      }
      /** The primary side's spans for a group, wherever a split has put them, in document order. */
      function primarySpans(id) {
        return Array.prototype.filter.call(document.querySelectorAll('.aligned-sentence[data-alignment="' + id + '"]'), function (span) {
          return !span.closest('.almonium-secondary, .almonium-companion, .almonium-companion-paragraph, .almonium-demand');
        });
      }
      function secondarySpans(unit, id) {
        return Array.prototype.slice.call(unit.secondary.querySelectorAll('.aligned-sentence[data-alignment="' + id + '"]'));
      }
      function companionSpans(id) {
        return Array.prototype.slice.call(document.querySelectorAll('.almonium-companion[data-alignment="' + id + '"]'));
      }

      document.querySelectorAll('span.seg-pair').forEach(function (pair) {
        var block = pair.parentElement;
        if (!block || !block.matches(BLOCKS)) return;
        var primary = null, secondary = null;
        Array.prototype.forEach.call(pair.children, function (seg) {
          if (!seg.classList.contains('segment')) return;
          if (isSecondary(seg)) secondary = seg; else if (!primary) primary = seg;
        });
        if (!primary || !secondary) return;
        secondary.classList.add('almonium-secondary');
        block.setAttribute('data-almonium-block', String(units.length));
        units.push({ block: block, primary: primary, secondary: secondary });
      });

      /** What a tap means: a sentence group, a paragraph, nothing (clears), or a control to leave alone. */
      function hitAt(target) {
        var el = target && target.nodeType === 1 ? target : target && target.parentElement;
        if (!el || !el.closest) return null;
        if (el.closest('.almonium-chapter-end, .almonium-chapter-head, .almonium-demand, a, button')) return 'ignore';
        var span = el.closest('.aligned-sentence[data-alignment], .almonium-companion[data-alignment]');
        var block = el.closest(BLOCKS);
        var origin = block && (block.__almoniumOrigin || block);
        var index = origin ? origin.getAttribute('data-almonium-block') : null;
        if (index === null) return null;
        var unit = units[Number(index)];
        if (!unit) return null;
        var id = span ? span.getAttribute('data-alignment') : null;
        return { unit: unit, id: validId(id) ? id : null };
      }

      function litNodes(hit) {
        if (hit.id) return primarySpans(hit.id).concat(mode === 'inline' ? companionSpans(hit.id) : []);
        var nodes = [hit.unit.primary];
        var next = hit.unit.block.nextElementSibling;
        if (mode === 'inline' && next && next.classList.contains('almonium-companion-paragraph')) nodes.push(next);
        return nodes;
      }

      function restore() {
        var demand = state.demand;
        state.demand = null;
        if (demand.tail) {
          while (demand.tail.firstChild) demand.primary.appendChild(demand.tail.firstChild);
          demand.tail.remove();
          demand.primary.normalize();
          demand.block.classList.remove('almonium-head');
        }
        demand.node.remove();
      }
      function clear() {
        state.lit.forEach(function (node) { node.classList.remove('almonium-lit'); node.classList.remove('almonium-selected'); });
        state.lit = [];
        state.key = null;
        if (state.demand) restore();
      }
      function reveal(node) {
        if (reduceMotion || typeof node.animate !== 'function') return;
        var height = node.getBoundingClientRect().height;
        node.style.overflow = 'hidden';
        var animation = node.animate([{ height: '0px', opacity: 0 }, { height: height + 'px', opacity: 1 }], { duration: 160, easing: 'ease' });
        animation.onfinish = function () { node.style.overflow = ''; };
      }

      /** On demand: the companion sentences open after the group, the paragraph continuing under them. */
      function openDemand(hit) {
        var unit = hit.unit, block = unit.block, primary = unit.primary, tail = null;
        var node = document.createElement('div');
        node.className = 'almonium-demand';
        var inner = document.createElement('div');
        inner.className = 'almonium-demand-inner';
        node.appendChild(inner);
        if (hit.id) {
          secondarySpans(unit, hit.id).forEach(function (span, index) {
            if (index) inner.appendChild(document.createTextNode(' '));
            inner.appendChild(cleanClone(span));
          });
          var spans = primarySpans(hit.id);
          var last = spans[spans.length - 1];
          if (last && primary.contains(last)) {
            var range = document.createRange();
            range.setStartAfter(last);
            range.setEnd(primary, primary.childNodes.length);
            if (range.toString().trim()) {
              var rest = range.extractContents();
              tail = block.cloneNode(false);
              tail.removeAttribute('id');
              tail.removeAttribute('data-almonium-block');
              tail.classList.add('almonium-tail');
              tail.__almoniumOrigin = block;
              tail.appendChild(rest);
              block.classList.add('almonium-head');
              node.classList.add('almonium-split');
              block.after(node, tail);
            }
          }
        } else {
          Array.prototype.forEach.call(unit.secondary.childNodes, function (child) { inner.appendChild(cleanClone(child)); });
        }
        if (!tail) block.after(node);
        state.demand = { node: node, block: block, primary: primary, tail: tail };
        reveal(node);
      }

      function select(hit) {
        var key = hit.id ? 'g:' + hit.id : 'b:' + hit.unit.block.getAttribute('data-almonium-block');
        if (state.key === key) { clear(); return; }
        clear();
        state.key = key;
        state.lit = litNodes(hit);
        state.lit.forEach(function (node) {
          node.classList.add('almonium-lit');
          if (mode === 'on-demand') node.classList.add('almonium-selected');
        });
        if (mode === 'on-demand') openDemand(hit);
      }

      /** Inline: each group's companion follows it in the flow; a paragraph without groups gets a companion paragraph. */
      function layoutInline() {
        units.forEach(function (unit) {
          var chunks = [], current = null;
          Array.prototype.forEach.call(unit.secondary.childNodes, function (node) {
            var id = node.nodeType === 1 && node.matches('.aligned-sentence[data-alignment]') ? node.getAttribute('data-alignment') : null;
            if (!validId(id) || !unit.primary.querySelector('.aligned-sentence[data-alignment="' + id + '"]')) id = null;
            if (id && (!current || current.id !== id)) { current = { id: id, nodes: [] }; chunks.push(current); }
            else if (!id && !current) { current = { id: null, nodes: [] }; chunks.push(current); }
            current.nodes.push(node);
          });
          if (!chunks.some(function (chunk) { return chunk.id; })) {
            var paragraph = document.createElement('p');
            paragraph.className = 'almonium-companion-paragraph';
            paragraph.__almoniumOrigin = unit.block;
            Array.prototype.forEach.call(unit.secondary.childNodes, function (child) { paragraph.appendChild(cleanClone(child)); });
            unit.block.after(paragraph);
            return;
          }
          if (!chunks[0].id) { chunks[1].nodes = chunks[0].nodes.concat(chunks[1].nodes); chunks.shift(); }
          unit.block.classList.add('almonium-mixed');
          chunks.forEach(function (chunk) {
            var mine = unit.primary.querySelectorAll('.aligned-sentence[data-alignment="' + chunk.id + '"]');
            var span = document.createElement('span');
            span.className = 'almonium-companion';
            span.setAttribute('data-alignment', chunk.id);
            chunk.nodes.forEach(function (node) { span.appendChild(cleanClone(node)); });
            mine[mine.length - 1].after(' ', span);
          });
        });
      }
      function clearInline() {
        document.querySelectorAll('.almonium-companion').forEach(function (span) {
          var before = span.previousSibling;
          if (before && before.nodeType === 3 && before.nodeValue === ' ') before.remove();
          span.remove();
        });
        document.querySelectorAll('.almonium-companion-paragraph').forEach(function (node) { node.remove(); });
        units.forEach(function (unit) { unit.block.classList.remove('almonium-mixed'); unit.primary.normalize(); });
      }

      function setMode(next) {
        if (next !== 'inline' && next !== 'on-demand') return;
        clear();
        clearInline();
        mode = next;
        if (mode === 'inline') layoutInline();
      }

      document.addEventListener('selectionchange', function () {
        var selection = window.getSelection();
        if (selection && selection.toString().trim()) lastSelectionAt = Date.now();
      });
      document.addEventListener('click', function (event) {
        var selection = window.getSelection();
        // A tap that only dismisses a word selection is not a sentence tap.
        if ((selection && selection.toString().trim()) || Date.now() - lastSelectionAt < 350) return;
        var hit = hitAt(event.target);
        if (hit === 'ignore') return;
        if (!hit) { clear(); return; }
        select(hit);
      });
      document.addEventListener('keydown', function (event) { if (event.key === 'Escape') clear(); });

      if (mode === 'inline') layoutInline();
      window.__almoniumParallel = { setMode: setMode, clear: clear };
    })();
  `;
}

/** Switches the companion mode on a loaded page; a no-op before the runtime is there. */
export function parallelModeScript(mode: ParallelMode) {
  if (mode === 'off') return 'true;';
  return `(function () { if (window.__almoniumParallel) window.__almoniumParallel.setMode(${JSON.stringify(mode)}); })(); true;`;
}
