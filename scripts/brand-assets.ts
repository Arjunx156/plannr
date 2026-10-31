/**
 * Renders the share image and app icons from HTML in Plannr's own fonts.
 * Run after changing the brand: `bun scripts/brand-assets.ts`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const root = join(import.meta.dir, "..");
// Embedded, because a page set from a string can't read local files.
const font = (pkg: string, file: string) =>
  `data:font/woff2;base64,${readFileSync(join(root, "node_modules", pkg, "files", file)).toString("base64")}`;

const faces = `
@font-face { font-family: Newsreader; src: url(${font("@fontsource-variable/newsreader", "newsreader-latin-opsz-normal.woff2")}); font-weight: 200 800; }
@font-face { font-family: Newsreader; font-style: italic; src: url(${font("@fontsource-variable/newsreader", "newsreader-latin-opsz-italic.woff2")}); font-weight: 200 800; }
@font-face { font-family: Hanken; src: url(${font("@fontsource-variable/hanken-grotesk", "hanken-grotesk-latin-wght-normal.woff2")}); font-weight: 100 900; }
@font-face { font-family: Plex; src: url(${font("@fontsource/ibm-plex-mono", "ibm-plex-mono-latin-500-normal.woff2")}); }
`;

const bars = [
  ["Catering", "₹4,50,000", 100, "#6E1F2E"],
  ["Venue", "₹3,20,000", 71, "#D9962B"],
  ["Décor", "₹2,40,000", 53, "#3D7A4F"],
  ["Attire", "₹2,20,000", 49, "#1F5F6B"],
  ["Photography", "₹1,80,000", 40, "#B5452B"],
] as const;

const og = `<!doctype html><html><head><meta charset="utf-8"><style>${faces}
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; background: #faf7f1; color: #1f1b16; font-family: Hanken, sans-serif; position: relative; overflow: hidden; }
.toran { height: 18px; background: radial-gradient(circle at 10px 0, #d9962b 9px, transparent 9.5px) 0 0 / 20px 18px repeat-x; }
.wrap { display: grid; grid-template-columns: 1fr 470px; gap: 56px; padding: 58px 72px; }
.logo { font: italic 500 44px/1 Newsreader, serif; display: flex; align-items: center; gap: 10px; }
.logo i { width: 11px; height: 11px; border-radius: 50%; background: #d9962b; margin-top: 14px; }
h1 { font: 500 64px/1.04 Newsreader, serif; letter-spacing: -0.015em; margin-top: 64px; }
h1 em { color: #6e1f2e; }
p { font-size: 25px; line-height: 1.4; color: #4a4239; margin-top: 26px; max-width: 560px; }
.card { align-self: start; background: #fff; border: 1px solid #e4dccd; border-radius: 22px; padding: 30px; margin-top: 40px; box-shadow: 0 24px 50px rgba(40,25,10,.12); display: flex; flex-direction: column; gap: 14px; }
.eyebrow { font: 500 15px Plex, monospace; letter-spacing: .08em; text-transform: uppercase; color: #1f5f6b; }
.title { font: 500 34px/1.1 Newsreader, serif; }
.row { display: grid; grid-template-columns: 120px 1fr 108px; gap: 12px; align-items: center; font-size: 17px; }
.bar { height: 11px; border-radius: 3px; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.chips { display: flex; gap: 8px; margin-top: 6px; }
.chips span { font-size: 15px; font-weight: 500; color: #4a4239; background: #efe9de; border-radius: 999px; padding: 7px 14px; }
</style></head><body><div class="toran"></div><div class="wrap"><div>
<div class="logo">Plannr<i></i></div>
<h1>Describe the day.<br><em>Get a plan you can run.</em></h1>
<p>Weddings, birthdays and community events, planned together in your language.</p>
</div><div class="card"><span class="eyebrow">◆ Drafted from one sentence</span><span class="title">Kerala wedding, 250 guests</span>
${bars.map(([n, a, w, c]) => `<div class="row"><span>${n}</span><span class="bar" style="width:${w}%;background:${c}"></span><span class="num">${a}</span></div>`).join("")}
<div class="chips"><span>71 tasks</span><span>11 vendors</span><span>4 guest groups</span></div>
</div></div></body></html>`;

const mark = (size: number, pad: number) => `<!doctype html><html><head><style>
* { margin: 0; } body { width: ${size}px; height: ${size}px; background: #1f1b16; display: grid; place-items: center; }
svg { width: ${size - pad * 2}px; height: ${size - pad * 2}px; }
</style></head><body><svg viewBox="0 0 64 64"><path d="M23 47V17h11a9.5 9.5 0 0 1 0 19H23" fill="none" stroke="#faf7f1" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="45" cy="45" r="5" fill="#d9962b"/></svg></body></html>`;

const browser = await chromium.launch();
async function shot(html: string, width: number, height: number, file: string) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, "public", file) });
  await page.close();
  console.log(`wrote public/${file}`);
}
await shot(og, 1200, 630, "og.png");
// Full-bleed squares double as maskable icons: the mark sits inside the safe zone.
await shot(mark(512, 96), 512, 512, "icon-512.png");
await shot(mark(192, 36), 192, 192, "icon-192.png");
await shot(mark(180, 30), 180, 180, "apple-touch-icon.png");
await browser.close();
