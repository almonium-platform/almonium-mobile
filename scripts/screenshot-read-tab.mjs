// Renders the Read tab's 4a frames on Expo web (shelf with one book, library, shelf offline, shelf
// in dark) with a stubbed Firebase sign-in and a fixture API, so the screens can be seen without
// an account or a backend. Start the web server first:
//   CI=1 node node_modules/expo/bin/cli start --web --port 8099
// then `node scripts/screenshot-read-tab.mjs <out-dir>`. Playwright comes from ../almonium-fe.
// Chromium's NetInfo listens to navigator.connection "change" only, hence the dispatched events.
import { chromium } from '../../almonium-fe/node_modules/playwright/index.mjs';
import { Buffer } from 'node:buffer';

const out = process.argv[2] ?? process.cwd();
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const email = 'reader@example.com';
const jwt = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: 'https://securetoken.google.com/almonium', aud: 'almonium', auth_time: now, user_id: 'u1', sub: 'u1', iat: now, exp: now + 3600, email, email_verified: true, firebase: { identities: { email: [email] }, sign_in_provider: 'password' } })}.sig`;

const book = (id, workSlug, title, author, level, wordCount, over = {}) => ({
  id, editionSlug: `${workSlug}-en-${level.toLowerCase()}`, workSlug, title, author, publicationYear: 1800, coverUrl: null, wordCount,
  language: 'EN', cefrLevel: level, progressPercentage: null, hasParallelTranslation: true, hasTranslation: true, isTranslation: false, ...over,
});
const frank = book('11111111-1111-4111-8111-111111111111', 'frankenstein', 'Frankenstein; or, The Modern Prometheus', 'Mary Shelley', 'C1', 75000, { progressPercentage: 12 });
const pride = book('22222222-2222-4222-8222-222222222222', 'pride-and-prejudice', 'Pride and Prejudice', 'Jane Austen', 'B2', 122000);
const time = book('33333333-3333-4333-8333-333333333333', 'the-time-machine', 'The Time Machine', 'H. G. Wells', 'B1', 33000);
const available = [
  pride, book('22222222-2222-4222-8222-222222222223', 'pride-and-prejudice', 'Pride and Prejudice', 'Jane Austen', 'C1', 122400),
  time, book('33333333-3333-4333-8333-333333333334', 'the-time-machine', 'The Time Machine', 'H. G. Wells', 'B2', 33500),
  book('44444444-4444-4444-8444-444444444444', 'dubliners', 'Dubliners', 'James Joyce', 'C1', 68000),
  book('44444444-4444-4444-8444-444444444445', 'dubliners', 'Dubliners', 'James Joyce', 'C2', 68000),
  book('55555555-5555-4555-8555-555555555555', 'dracula', 'Dracula', 'Bram Stoker', 'C1', 161000, { hasParallelTranslation: false }),
  book('66666666-6666-4666-8666-666666666666', 'alice', "Alice's Adventures in Wonderland", 'Lewis Carroll', 'A2', 27000),
  book('66666666-6666-4666-8666-666666666667', 'alice', "Alice's Adventures in Wonderland", 'Lewis Carroll', 'B1', 27500),
  book('77777777-7777-4777-8777-777777777777', 'frankenstein', 'Frankenstein; or, The Modern Prometheus', 'Mary Shelley', 'B2', 74000),
];
let variant = 'one';
const shelf = () => ({
  continueReading: variant === 'one' ? [frank] : [frank, { ...pride, progressPercentage: 41 }, { ...time, cefrLevel: 'B2', progressPercentage: 88 }],
  available, favorites: [],
});
const profile = {
  id: 'u1', username: 'reader', email, emailVerified: true, hidden: false, avatarUrl: null, fluentLangs: ['UK'],
  learners: [{ id: 'l1', language: 'EN', selfReportedLevel: 'B2', active: true }], premium: false, setupStep: 'COMPLETED',
  subscription: { name: 'Free', limits: {}, type: 'MONTHLY', autoRenewal: false, startDate: null, endDate: null }, interests: [],
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light', isMobile: true, hasTouch: true });
await context.route(/identitytoolkit\.googleapis\.com/, (route) => {
  const url = route.request().url();
  const body = url.includes('signInWithPassword') ? { localId: 'u1', email, idToken: jwt, registered: true, refreshToken: 'r', expiresIn: '3600' }
    : url.includes('accounts:lookup') ? { users: [{ localId: 'u1', email, emailVerified: true, providerUserInfo: [{ providerId: 'password', email }], validSince: '0', lastLoginAt: String(Date.now()), createdAt: String(Date.now()) }] }
    : {};
  return route.fulfill({ json: body });
});
await context.route(/securetoken\.googleapis\.com/, (route) => route.fulfill({ json: { access_token: jwt, id_token: jwt, refresh_token: 'r', expires_in: '3600', user_id: 'u1' } }));
await context.route(/\/api\/v1\//, (route) => {
  const path = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1/, '');
  const json = path === '/users/me' ? profile : path.startsWith('/books/language/') ? shelf() : path.startsWith('/learning/rhythm') ? null : [];
  return route.fulfill({ json: json ?? {} , status: json === null ? 204 : 200 });
});
const page = await context.newPage();
page.on('pageerror', (error) => console.log('pageerror', error.message));
await page.goto('http://localhost:8099/sign-in', { waitUntil: 'networkidle' });
await page.evaluate(({ frank }) => {
  localStorage.setItem('almonium:offline-books', JSON.stringify([{ ...frank, downloadedAt: new Date().toISOString(), size: 812000 }]));
  localStorage.setItem('almonium:reading-places', JSON.stringify({ [frank.id]: { chapter: 3, total: 24, at: new Date().toISOString() } }));
  localStorage.setItem('almonium:shelf-language', 'EN');
}, { frank });
await page.getByPlaceholder('Email').fill(email);
await page.getByPlaceholder('Password').fill('password123');
await page.getByText('Sign in', { exact: true }).last().click();
await page.waitForURL(/\/(home|books)/, { timeout: 30000 }).catch((error) => console.log('no redirect', page.url(), error.message));
await page.goto('http://localhost:8099/books', { waitUntil: 'networkidle' });
await page.getByText('YOUR SHELF').waitFor({ timeout: 20000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/shelf-one.png` });
await page.getByText(/^All \d+ books$/).click();
await page.waitForURL(/\/library/);
await page.getByPlaceholder('Title or author').waitFor();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/library.png` });
await page.getByText('C1', { exact: true }).first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/library-c1.png` });

variant = 'three';
await page.goto('http://localhost:8099/books', { waitUntil: 'networkidle' });
await page.getByText('Three books open').waitFor({ timeout: 20000 });
await context.setOffline(true);
await page.waitForTimeout(400);
console.log('onLine', await page.evaluate(() => navigator.onLine));
await page.evaluate(() => { window.dispatchEvent(new Event('offline')); navigator.connection?.dispatchEvent(new Event('change')); });
await page.waitForTimeout(1200);
console.log('subhead', await page.getByText('No connection').count());
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/shelf-offline.png` });
await context.setOffline(false);
await page.evaluate(() => { window.dispatchEvent(new Event('online')); navigator.connection?.dispatchEvent(new Event('change')); });
await page.emulateMedia({ colorScheme: 'dark' });
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/shelf-dark.png` });
await browser.close();
console.log('done');
