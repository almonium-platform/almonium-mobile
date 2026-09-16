// Read-only fixture check of the companion runtime in Chromium (design L, mobile L6–L7): nothing
// painted at rest, On demand opening one group's companion after it and splitting the paragraph,
// Inline interleaving at sentence level, and a mode switch on the page. No backend, no native UI.
import { chromium } from '../../almonium-fe/node_modules/playwright/index.mjs';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';

async function load(relative) {
  const source = await readFile(new URL(relative, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const parallel = await load('../src/reader-parallel.ts');
const chapters = await load('../src/reader-chapters.ts');

const group = (side, id, text) => `<span class="aligned-sentence" role="button" tabindex="0" data-alignment="${id}">${text}</span>`;
const pair = (primary, secondary) =>
  `<span class="seg-pair"><span class="segment" data-side="primary" lang="EN">${primary}</span><span class="segment" data-side="secondary" lang="UK">${secondary}</span></span>`;
const html = '<style>body{margin:0;font-size:19px;line-height:1.65} .almonium-secondary{display:none}</style>'
  + '<h2 class="chapter-title" id="chapter-1">CHAPTER I.</h2>'
  // Three sentences; the first two are certain groups, the third is unaligned on both sides.
  + `<p id="one">${pair(
    `${group('p', '1-1-0', 'First sentence.')} ${group('p', '1-1-1', 'Second sentence, which is longer.')} Third, unaligned.`,
    `${group('s', '1-1-0', 'Перше речення.')} ${group('s', '1-1-1', 'Друге речення, довше.')} Третє, без пари.`)}</p>`
  // A paragraph with no sentence groups at all.
  + `<p id="two">${pair('Whole paragraph only.', 'Лише цілий абзац.')}</p>`
  // A group that ends the paragraph: no split, the block simply follows.
  + `<p id="three">${pair(group('p', '1-3-0', 'Last sentence is the group.'), group('s', '1-3-0', 'Остання група.'))}</p>`;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await page.setContent(html);
  await page.evaluate(() => {
    window.messages = [];
    window.ReactNativeWebView = { postMessage: text => window.messages.push(JSON.parse(text)) };
  });
  await page.evaluate(parallel.parallelScript('UK', 'on-demand', true));
  await page.evaluate(chapters.chapterDiscoveryScript);

  // Rest: the secondary side is hidden, nothing is lit, chapters ignore the companion.
  assert.equal(await page.locator('.almonium-secondary').count(), 3);
  assert.equal(await page.locator('.almonium-lit').count(), 0);
  assert.deepEqual((await page.evaluate(() => window.messages.at(-1))).chapters.map(c => c.anchor), ['chapter-1']);

  // On demand: tap the first group. It lights with the rule, the paragraph splits after it, the companion is that group only.
  await page.locator('#one [data-side="primary"] [data-alignment="1-1-0"]').click();
  assert.equal(await page.locator('#one .almonium-lit.almonium-selected').count(), 1);
  assert.equal(await page.locator('.almonium-demand-inner').textContent(), 'Перше речення.');
  assert.ok(await page.locator('#one').evaluate(p => p.classList.contains('almonium-head')));
  assert.equal(await page.locator('#one').evaluate(p => p.innerText.replace(/\s+/g, " ").trim()), 'First sentence.');
  assert.equal(await page.locator('.almonium-tail').evaluate(p => p.innerText.replace(/\s+/g, " ").trim()), 'Second sentence, which is longer. Third, unaligned.');
  assert.deepEqual(await page.evaluate(() => Array.from(document.querySelectorAll('#one ~ *')).slice(0, 2).map(n => n.className)), ['almonium-demand', 'almonium-tail']);
  // The companion copy carries no alignment ids, so it can never be hit-tested as a sentence.
  assert.equal(await page.locator('.almonium-demand [data-alignment]').count(), 0);

  // Tap the second group, now in the tail: the paragraph is restored and split again after that group.
  await page.locator('.almonium-tail [data-alignment="1-1-1"]').click();
  assert.equal(await page.locator('.almonium-demand').count(), 1);
  assert.equal(await page.locator('.almonium-demand-inner').textContent(), 'Друге речення, довше.');
  assert.equal(await page.locator('#one').evaluate(p => p.innerText.replace(/\s+/g, " ").trim()), 'First sentence. Second sentence, which is longer.');
  assert.equal(await page.locator('.almonium-tail').evaluate(p => p.innerText.replace(/\s+/g, " ").trim()), 'Third, unaligned.');
  assert.equal(await page.locator('#one .almonium-selected').count(), 1);
  assert.equal(await page.locator('#one .almonium-selected').getAttribute('data-alignment'), '1-1-1');

  // Tap the same group again: it closes and the paragraph is whole once more.
  await page.locator('#one [data-side="primary"] [data-alignment="1-1-1"]').click();
  assert.equal(await page.locator('.almonium-demand').count(), 0);
  assert.equal(await page.locator('.almonium-tail').count(), 0);
  assert.equal(await page.locator('.almonium-lit').count(), 0);
  assert.equal(await page.locator('#one').evaluate(p => p.innerText.replace(/\s+/g, " ").trim()), 'First sentence. Second sentence, which is longer. Third, unaligned.');
  assert.equal(await page.locator('#one [data-side="primary"] [data-alignment]').count(), 2, 'the group spans survive a round trip');

  // A paragraph without groups: the whole paragraph is the unit, its companion paragraph opens after it.
  await page.locator('#two').click();
  assert.equal(await page.locator('.almonium-demand-inner').textContent(), 'Лише цілий абзац.');
  assert.ok(await page.locator('#two .segment[data-side="primary"]').evaluate(s => s.classList.contains('almonium-lit')));
  assert.equal(await page.locator('.almonium-tail').count(), 0);

  // A group that ends its paragraph: no split, the block follows the paragraph. Only one block is ever open.
  await page.locator('#three [data-side="primary"] [data-alignment="1-3-0"]').click();
  assert.equal(await page.locator('.almonium-demand').count(), 1);
  assert.equal(await page.locator('.almonium-tail').count(), 0);
  assert.equal(await page.evaluate(() => document.getElementById('three').nextElementSibling.className), 'almonium-demand');

  // A tap elsewhere clears; so does Escape.
  await page.locator('h2').click();
  assert.equal(await page.locator('.almonium-demand').count(), 0);
  await page.locator('#three [data-side="primary"] [data-alignment="1-3-0"]').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.almonium-lit').count(), 0);

  // Inline, switched on the page: each group's companion follows it in the flow; the unaligned tail rides with the last group.
  await page.evaluate(parallel.parallelModeScript('inline'));
  assert.equal(await page.locator('#one .almonium-companion').count(), 2);
  assert.equal(await page.locator('#one').evaluate(p => p.innerText.replace(/\s+/g, " ").trim()),
    'First sentence. Перше речення. Second sentence, which is longer. Друге речення, довше. Третє, без пари. Third, unaligned.');
  assert.ok(await page.locator('#one').evaluate(p => p.classList.contains('almonium-mixed')));
  assert.equal(await page.locator('#two + p.almonium-companion-paragraph').textContent(), 'Лише цілий абзац.');
  // A tap tints both halves, with no rule; the companion half answers too.
  await page.locator('#one .almonium-companion[data-alignment="1-1-1"]').click();
  assert.equal(await page.locator('#one .almonium-lit').count(), 2);
  assert.equal(await page.locator('.almonium-selected').count(), 0);
  assert.equal(await page.locator('.almonium-demand').count(), 0);
  await page.locator('#one [data-side="primary"] [data-alignment="1-1-1"]').first().click();
  assert.equal(await page.locator('.almonium-lit').count(), 0);
  // Chapter discovery still ignores the companion paragraph.
  await page.evaluate(chapters.chapterDiscoveryScript);
  assert.deepEqual((await page.evaluate(() => window.messages.at(-1))).chapters.map(c => c.anchor), ['chapter-1']);

  // Back to On demand: the flow is exactly the source again.
  await page.evaluate(parallel.parallelModeScript('on-demand'));
  assert.equal(await page.locator('.almonium-companion, .almonium-companion-paragraph, .almonium-mixed').count(), 0);
  assert.equal(await page.locator('#one').evaluate(p => p.innerText.replace(/\s+/g, " ").trim()), 'First sentence. Second sentence, which is longer. Third, unaligned.');
  await page.locator('#one [data-side="primary"] [data-alignment="1-1-0"]').click();
  assert.equal(await page.locator('.almonium-demand-inner').textContent(), 'Перше речення.');

  console.log('reader parallel: ok');
} finally {
  await browser.close();
}
