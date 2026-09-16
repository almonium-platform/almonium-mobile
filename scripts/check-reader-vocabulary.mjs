// Read-only integration check. Uses the sibling web client's installed Playwright.
// This exercises WebView JavaScript in Chromium, not native sheet rendering.
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
const vocabulary = await load('../src/reader-vocabulary.ts');
const { parallelScript } = await load('../src/reader-parallel.ts');
const base = process.env.READER_CHECK_API ?? 'http://localhost:9998/api/v1';
const slug = 'shelley-frankenstein-en-orig';
async function get(path, json = true) {
  const response = await fetch(`${base}/public/books/${slug}${path}`);
  assert.equal(response.status, 200, path);
  return json ? response.json() : response.text();
}
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  async function discover(html, mode = 'off') {
    await page.goto('about:blank');
    await page.setContent(html);
    await page.evaluate(() => {
      window.messages = [];
      window.ReactNativeWebView = { postMessage: text => window.messages.push(JSON.parse(text)) };
    });
    await page.evaluate(parallelScript('UK', mode));
    await page.evaluate(chapters.chapterDiscoveryScript);
    return chapters.parseReaderChapters(await page.evaluate(() => window.messages[0].chapters));
  }
  for (const mode of ['off', 'inline', 'on-demand']) {
    const entries = await discover('<h2 class="chapter-title" id="chapter-11"><span class="seg-pair"><span class="segment" data-side="primary">Chapter V</span><span class="segment" data-side="secondary">Розділ V</span></span></h2><p style="height:1000px">Text</p><h2 class="chapter-title" id="chapter-30">Final chapter</h2><p style="height:1000px">More</p><div data-side="secondary"><h2 class="chapter-title" id="chapter-30">Duplicate</h2></div>', mode);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].title, 'Chapter V');
    assert.equal(vocabulary.vocabularySequence(entries[0]), 11);
    await page.evaluate(chapters.chapterJumpScript(1));
    assert.ok(await page.evaluate(() => window.scrollY > 900));
    console.log(`${mode}: primary-only navigation and vocabulary sequence passed (fixture)`);
  }
  const entries = await discover(await get('/text', false));
  assert.equal(entries.length, 30);
  const chapter = entries.find(row => row.anchor === 'chapter-11');
  assert.ok(chapter);
  const sequence = vocabulary.vocabularySequence(chapter);
  assert.equal(sequence, 11);
  const enrichment = chapters.parseChapterEnrichments(await get('/chapters'));
  assert.ok(chapters.chapterEnrichment(chapter, enrichment));
  const data = vocabulary.parseChapterVocabulary(await get(`/chapters/${sequence}/vocabulary`), sequence);
  assert.equal(data.status, 'ready');
  assert.ok(data.words.length > 0);
  const word = data.words.find(row => row.lemma === 'countenance');
  assert.ok(word);
  const selection = vocabulary.vocabularyLookup(word, data, slug, 'Frankenstein', chapter.title);
  assert.equal(vocabulary.readerLookupLanguage(selection, 'DE'), 'EN');
  assert.equal(selection.source.chapter, 11);
  assert.equal(selection.source.book, slug);
  assert.ok(selection.context.includes(word.surface));
  await page.evaluate(chapters.chapterJumpScript(chapter.index));
  assert.ok(await page.evaluate(() => window.scrollY > 0));
  console.log(`Live original: ${entries.length} headings, Chapter V jump, ${data.words.length} words, EN lookup context passed`);
  console.log('No lookup/provider request, auth bypass, publication or native UI acceptance performed.');
} finally {
  await browser.close();
}
