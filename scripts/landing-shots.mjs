// Alkusivun kuvat esimerkkitilasta (24.11.2026): kuvaa sovelluksen näkymät keksityillä tiedoilla (Aino ja Eino,
// src/demo/seedDemo.ts) ja tallentaa ne kansioon public/landing. Ei lisäriippuvuuksia: selain (Edge tai Chrome)
// käynnistetään näkymättömänä ja sitä ohjataan DevTools-protokollalla Noden omalla WebSocketilla (Node 22+).
//
// Aja, kun käyttöliittymä on muuttunut näkyvästi:
//   1. npm run dev        (kehityspalvelin, oletus http://localhost:5173/)
//   2. npm run shots      (tai: node scripts/landing-shots.mjs [osoite] [kuva,kuva])
// Selaimen polku: ympäristömuuttuja BROWSER, muuten Edge tai Chrome tavallisesta paikasta.
//
// Tarkat versiot kuvataan suoraan (PC 2x = 2560 px, puhelin 3x = 1170 px leveä) ja perusversiot pienennetään
// niistä selaimessa (PC 1280 px, puhelin 780 px), kuten Landing.tsx:n srcSet odottaa.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const URL_ = process.argv[2] && !process.argv[2].includes(',') && process.argv[2].startsWith('http') ? process.argv[2] : 'http://localhost:5173/';
const ONLY = process.argv.slice(2).find((a) => !a.startsWith('http'))?.split(',');
const OUT = join(import.meta.dirname, '..', 'public', 'landing');
const Q = 0.9;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CANDIDATES = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const BROWSER = CANDIDATES.find((p) => p && existsSync(p));
if (!BROWSER) throw new Error('Selainta ei löytynyt: anna polku ympäristömuuttujassa BROWSER.');
try {
  await fetch(URL_);
} catch {
  throw new Error(`Kehityspalvelin ei vastaa osoitteessa ${URL_}: käynnistä se ensin (npm run dev).`);
}

// ---------- selain ja DevTools-yhteys ----------
const port = 9300 + Math.floor(Math.random() * 600);
const profile = mkdtempSync(join(tmpdir(), 'landing-shots-'));
const browser = spawn(
  BROWSER,
  [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--no-first-run', '--hide-scrollbars', '--window-size=1400,1000', 'about:blank'],
  { stdio: 'ignore' },
);
let list;
for (let i = 0; i < 80 && !list?.some((t) => t.type === 'page'); i++) {
  await sleep(250);
  list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json(), () => undefined);
}
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let seq = 0;
const waiting = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) {
    waiting.get(m.id)(m);
    waiting.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++seq;
    waiting.set(id, (m) => (m.error ? rej(new Error(`${method}: ${JSON.stringify(m.error)}`)) : res(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 600));
  return r.result.value;
};

// ---------- apufunktiot ----------
// Kuvissa ei animaatioita eikä esimerkkitilan palkkia.
const STILL = `(() => { const s = document.createElement('style'); s.textContent = '*{animation:none!important;transition:none!important;caret-color:transparent!important} [data-demo-banner]{display:none!important}'; document.head.appendChild(s); return 1; })()`;
const PREFS = ['theme', 'accent', 'background', 'calendarFamily', 'calendarTrainings', 'calendarMode'];

async function open(width, height, phone, tab, prefs = {}) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: phone ? 3 : 2, mobile: phone });
  await evaluate(`(() => { for (const k of ${JSON.stringify(PREFS)}) localStorage.removeItem(k); const o = ${JSON.stringify(prefs)}; for (const k in o) localStorage.setItem(k, o[k]); localStorage.setItem('tab', '${tab}'); return 1; })()`);
  await send('Page.reload');
  await sleep(4500);
  await evaluate(STILL);
  await sleep(700);
}
const click = (pred) =>
  evaluate(`(async () => { const el = [...document.querySelectorAll('button, [role=radio], a')].find((b) => ${pred}); el?.click(); await new Promise((r) => setTimeout(r, 900)); return !!el; })()`);
const radio = (text) => click(`b.getAttribute('role') === 'radio' && b.textContent.trim() === '${text}'`);
const toGrid = (offset) => evaluate(`(() => { const g = document.querySelector('[role=grid]'); g?.scrollIntoView({ block: 'start' }); window.scrollBy(0, ${offset}); return !!g; })()`);
const story = async (cards) => {
  await click(`b.textContent.includes('Kauden kooste')`);
  await sleep(3500);
  for (let k = 0; k < cards; k++) await click(`b.getAttribute('aria-label') === 'Seuraava kortti'`);
  await sleep(1200);
};

async function shot(name) {
  if (ONLY && !ONLY.includes(name)) return;
  const phone = name.startsWith('phone-');
  const big = await send('Page.captureScreenshot', { format: 'webp', quality: Math.round(Q * 100) });
  writeFileSync(join(OUT, `${name}-${phone ? '3x' : '2x'}.webp`), Buffer.from(big.data, 'base64'));
  // Perusversio pienennetään tarkasta kuvasta (PC 1280 px, puhelin 780 px leveä).
  const small = await evaluate(`(async () => { const img = new Image(); img.src = 'data:image/webp;base64,${big.data}'; await img.decode();
    const w = ${phone ? 780 : 1280}, h = Math.round(img.height * w / img.width); const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h); return c.toDataURL('image/webp', ${Q}).split(',')[1]; })()`);
  writeFileSync(join(OUT, `${name}.webp`), Buffer.from(small, 'base64'));
  console.log('kuvattu', name);
}

try {
  // ---------- esimerkkitila ----------
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: URL_ });
  await sleep(2500);
  await evaluate(`(() => { localStorage.setItem('inviteAccepted', '1'); sessionStorage.setItem('demoMode', '1'); return 1; })()`);
  await send('Page.reload');
  await sleep(1000);
  // Aineisto luodaan ensimmäisellä käynnistyksellä; odotetaan, että molemmat lapset ovat valmiina.
  const ids = await evaluate(`(async () => { const { db } = await import('/src/db/schema.ts'); if (!db.name.endsWith('esimerkki')) throw new Error('ei esimerkkitilassa');
    for (let i = 0; i < 60; i++) { if (await db.meta.get('demoSeeded')) break; await new Promise((r) => setTimeout(r, 250)); }
    return (await db.profiles.orderBy('sortOrder').toArray()).map((p) => p.id); })()`);
  // Viikon juhlinta ei peitä kuvia: tämä viikko merkitään jo juhlituksi.
  await evaluate(`(async () => { const { startOfIsoWeek } = await import('/src/domain/dates.ts'); const { today } = await import('/src/ui/today.ts'); const w = startOfIsoWeek(today());
    localStorage.setItem('celebratedWeeks', JSON.stringify(Object.fromEntries(${JSON.stringify(ids)}.map((id) => [id, w])))); localStorage.setItem('selectedProfileId', '${ids[0]}'); return 1; })()`);
  const role = (r) => evaluate(`(async () => { const { repo } = await import('/src/db/repositories.ts'); ${r ? `await repo.setDeviceRole('${r}')` : `await repo.db.meta.delete('deviceRole')`}; return 1; })()`);

  // ---------- PC ----------
  await role('pc');
  await open(1280, 800, false, 'week');
  await shot('pc-week');
  await open(1280, 800, false, 'analysis');
  await radio('Kausi');
  await sleep(2000);
  await shot('pc-analysis');
  await open(1280, 800, false, 'games', { calendarMode: 'month', calendarTrainings: '1' });
  await radio('Kalenteri');
  await sleep(1200);
  await toGrid(-250);
  await sleep(600);
  await shot('pc-calendar');
  await open(1280, 800, false, 'week', { accent: 'heather', background: 'grass' });
  await shot('pc-theme');
  await open(1280, 800, false, 'games', { calendarMode: 'month', calendarFamily: '1' });
  await radio('Kalenteri');
  await sleep(1500);
  await toGrid(-250);
  await sleep(600);
  await shot('pc-family');
  await open(1280, 800, false, 'games');
  await story(3);
  await shot('pc-story');

  // ---------- puhelin (ei laiteroolia: puhelimen asettelu) ----------
  await role(undefined);
  await open(390, 844, true, 'week');
  await shot('phone-week');
  await click(`b.getAttribute('aria-label') === 'Lisää kerta'`);
  await sleep(800);
  await shot('phone-add');
  await open(390, 844, true, 'games', { calendarMode: 'list' });
  await radio('Tulokset');
  await sleep(1000);
  await shot('phone-football');
  await radio('Kalenteri');
  await sleep(800);
  await click(`b.textContent.trim() === 'Ennakko'`);
  await sleep(2500);
  await shot('phone-preview');
  await open(390, 844, true, 'analysis');
  await radio('Kausi');
  await sleep(2000);
  await evaluate(`window.scrollTo(0, 150); 1`);
  await sleep(600);
  await shot('phone-analysis');
  await open(390, 844, true, 'settings', { theme: 'dark', accent: 'forest', background: 'forest' });
  await click(`b.textContent.includes('Ulkoasu')`);
  await sleep(1200);
  await evaluate(`(() => { const h = [...document.querySelectorAll('h2,h3,h4')].find((e) => e.textContent.trim() === 'Vaalea vai tumma'); h?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -250); return 1; })()`);
  await sleep(800);
  await shot('phone-theme');
  await open(390, 844, true, 'games');
  await story(1);
  await shot('phone-story');
  await open(390, 844, true, 'games', { calendarMode: 'month', calendarFamily: '1' });
  await radio('Kalenteri');
  await sleep(1500);
  await toGrid(-170);
  await sleep(600);
  await shot('phone-family');
} finally {
  ws.close();
  browser.kill();
  await sleep(800);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // Väliaikainen selainprofiili jää käyttöjärjestelmän tyhjennettäväksi.
  }
}
process.exit(0);
