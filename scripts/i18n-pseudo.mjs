/**
 * Writes src/locales/pseudo.json from the extracted English catalogue: every string accented,
 * stretched and bracketed, so one pass through the app in the pseudo-locale shows which layouts a
 * longer language would break. `npm run i18n` extracts first and then runs this. The same script
 * lives in the web client.
 *
 *   [Šéţţîñĝš~~~~]     ← accents catch text that never went through t(); the tail is the
 *                        German-length surplus; a missing bracket is a clipped end.
 *
 * ICU placeholders (`{name}`) and the keywords of ICU expressions are left alone; only their case
 * bodies are stretched.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(root, 'src/locales/en.json');
const TARGET = join(root, 'src/locales/pseudo.json');

const ACCENTS = {
  a: 'á', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'î', j: 'ĵ', k: 'ķ', l: 'ĺ', m: 'ɱ',
  n: 'ñ', o: 'ö', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'û', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
  A: 'Á', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Î', J: 'Ĵ', K: 'Ķ', L: 'Ĺ', M: 'Ḿ',
  N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Û', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž',
};

/** Short strings grow the most: "OK" becomes a word, a paragraph grows by a third. */
function surplus(letters) {
  if (letters === 0) return 0;
  if (letters <= 5) return letters;
  if (letters <= 10) return Math.ceil(letters * 0.7);
  if (letters <= 20) return Math.ceil(letters * 0.5);
  return Math.ceil(letters * 0.35);
}

function closingBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i;
  }
  throw new Error(`Unbalanced braces in message: ${text}`);
}

/** Accents the translatable runs of a message and counts their letters. */
function stretch(text) {
  let out = '';
  let letters = 0;
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (char !== '{') {
      const accent = ACCENTS[char];
      if (accent) letters++;
      out += accent ?? char;
      i++;
      continue;
    }
    const close = closingBrace(text, i);
    const inner = text.slice(i + 1, close);
    const firstComma = inner.indexOf(',');
    const secondComma = firstComma < 0 ? -1 : inner.indexOf(',', firstComma + 1);
    if (secondComma < 0) {
      out += text.slice(i, close + 1); // a placeholder, or something we do not understand: verbatim
    } else {
      // An ICU expression: `{count, plural, =1 {one} other {many}}` keeps its head and keys, stretches its bodies.
      let body = '';
      const cases = inner.slice(secondComma + 1);
      let k = 0;
      while (k < cases.length) {
        const open = cases.indexOf('{', k);
        if (open < 0) {
          body += cases.slice(k);
          break;
        }
        const end = closingBrace(cases, open);
        const stretched = stretch(cases.slice(open + 1, end));
        letters += stretched.letters;
        body += `${cases.slice(k, open + 1)}${stretched.out}}`;
        k = end + 1;
      }
      out += `{${inner.slice(0, secondComma + 1)}${body}}`;
    }
    i = close + 1;
  }
  return { out, letters };
}

export function pseudo(message) {
  const { out, letters } = stretch(message);
  return `[${out}${'~'.repeat(surplus(letters))}]`;
}

async function main() {
  const messages = JSON.parse(await readFile(SOURCE, 'utf8'));
  const stretched = Object.fromEntries(Object.entries(messages).map(([key, message]) => [key, pseudo(message)]));
  await mkdir(dirname(TARGET), { recursive: true });
  await writeFile(TARGET, `${JSON.stringify(stretched, null, 2)}\n`);
  process.stdout.write(`${Object.keys(stretched).length} messages → ${TARGET}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
