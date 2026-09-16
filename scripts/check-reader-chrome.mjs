// Read-only fixture check of the reader's chapter scripts in Chromium: position and chrome
// reports, the chapter header, the chapter-end block and its messages. No backend, no native UI.
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
const chapters = await load('../src/reader-chapters.ts');
const html = '<style>body{margin:0}</style>'
  + '<h2 class="chapter-title" id="chapter-1">INTRODUCTION.</h2><p style="height:1200px">Front</p>'
  + '<h2 class="chapter-title" id="chapter-2">CHAPTER I.</h2><p style="height:1200px">One</p>'
  + '<h2 class="chapter-title" id="chapter-3">CHAPTER II.</h2><p style="height:1200px">Two</p>';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.setContent(html);
  await page.evaluate(() => {
    window.messages = [];
    window.ReactNativeWebView = { postMessage: text => window.messages.push(JSON.parse(text)) };
  });
  await page.evaluate(chapters.chapterDiscoveryScript);
  await page.evaluate(chapters.positionScript);
  const positions = () => page.evaluate(() => window.messages.filter(m => m.type === 'position'));
  await page.waitForTimeout(500);
  let last = (await positions()).at(-1);
  assert.deepEqual(last, { type: 'position', chapter: 0, chrome: true }, 'starts in the first chapter with the chrome shown');

  // A scroll down hides the chrome; a scroll back up shows it; the chapter follows the viewport.
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(100);
  last = (await positions()).at(-1);
  assert.deepEqual(last, { type: 'position', chapter: 1, chrome: false });
  await page.evaluate(() => window.scrollTo(0, 1400));
  await page.waitForTimeout(100);
  last = (await positions()).at(-1);
  assert.equal(last.chrome, true);

  // A chapter jump lands on the heading and keeps the chrome.
  await page.evaluate(chapters.chapterJumpScript(2));
  await page.waitForTimeout(100);
  last = (await positions()).at(-1);
  assert.deepEqual(last, { type: 'position', chapter: 2, chrome: true });

  // The header: data only, escaped, replaceable.
  await page.evaluate(chapters.chapterHeaderScript([{ index: 1, meta: 'Chapter 2 of 3 · Estimated B2', description: '<b>Not markup</b>' }]));
  await page.evaluate(chapters.chapterHeaderScript([{ index: 1, meta: 'Chapter 2 of 3 · Estimated B2', description: '<b>Not markup</b>' }]));
  assert.equal(await page.locator('.almonium-chapter-head').count(), 1);
  assert.equal(await page.locator('.almonium-chapter-desc').textContent(), '<b>Not markup</b>');
  assert.equal(await page.locator('.almonium-chapter-head b').count(), 0);

  // The chapter end: three rows shown, the rest folded, a tap posts the word, the next row scrolls.
  const words = Array.from({ length: 5 }, (_, i) => ({ lemma: `word${i}`, surface: `word${i}s`, context: `We saw word${i}s here.`, blockId: `c2.p${i}` }));
  await page.evaluate(chapters.chapterEndScript({ index: 1, title: 'Words from this chapter', note: '5 of the book’s useful words occur here.', words, shown: 3, allLabel: 'All 5 words',
    next: { index: 2, meta: 'Next · Estimated C1', title: 'Chapter II', description: 'What follows.' } }));
  const end = page.locator('.almonium-chapter-end[data-chapter="1"]');
  assert.equal(await end.count(), 1);
  assert.equal(await end.locator('.almonium-word:visible').count(), 3);
  assert.equal(await end.locator('mark').first().textContent(), 'word0s');
  await end.locator('.almonium-words-all').click();
  assert.equal(await end.locator('.almonium-word:visible').count(), 5);
  await end.locator('.almonium-word').nth(4).click();
  const tapped = await page.evaluate(() => window.messages.filter(m => m.type === 'chapter-word').at(-1));
  assert.deepEqual(tapped, { type: 'chapter-word', chapter: 1, blockId: 'c2.p4', lemma: 'word4' });
  const before = await page.evaluate(() => window.scrollY);
  await end.locator('.almonium-next').click();
  await page.waitForTimeout(100);
  assert.notEqual(await page.evaluate(() => window.scrollY), before);
  const heading = await page.evaluate(() => Math.round(document.getElementById('chapter-3').getBoundingClientRect().top));
  assert.ok(Math.abs(heading) <= 1, `next chapter heading at the top, got ${heading}`);
  // The block sits before the next heading, so it belongs to its chapter.
  assert.equal(await page.evaluate(() => document.querySelector('.almonium-chapter-end').nextElementSibling.id), 'chapter-3');
  console.log('Fixture: position/chrome reports, chapter jump, header injection, chapter-end rows, fold, word tap and next jump passed.');
  console.log('No backend request or native acceptance performed.');
} finally {
  await browser.close();
}
