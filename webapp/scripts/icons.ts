// 앱 아이콘 PNG 만들기 ('음악 마을' 1박 타일 그림) — 실행: npx vite-node scripts/icons.ts
import { createRequire } from 'module';
import fs from 'fs';
import * as ART from '../src/art/tiles';
import * as VG from '../src/art/village';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = 'public/icons';
fs.mkdirSync(out, { recursive: true });

const plainTile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="2 2 96 98">${VG.tile('q-s', 0, { beats: false })}</svg>`;
// 가장자리까지 꽉 찬 아이콘(마스커블·애플): 풀밭 + 흙길 + 4분음표
const fullBleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${VG.V.grass}"/>`
  + `<ellipse cx="24" cy="24" rx="16" ry="8" fill="${VG.V.grassHi}" opacity=".5"/><ellipse cx="76" cy="80" rx="18" ry="8" fill="${VG.V.grassHi}" opacity=".5"/>`
  + `<path d="M0 54H100" stroke="${VG.V.pathEdge}" stroke-width="25"/><path d="M0 54H100" stroke="${VG.V.path}" stroke-width="19.5"/>`
  + `<g transform="translate(50 54) scale(1.25) translate(-50 -50)">${ART.symGlyph('q', 50, 50)}</g></svg>`;

const jobs: [string, string, number][] = [
  ['icon-192.png', plainTile, 192],
  ['icon-512.png', plainTile, 512],
  ['icon-maskable-512.png', fullBleed, 512],
  ['apple-touch-icon.png', fullBleed, 180],
];
const browser = await chromium.launch();
for (const [name, svg, size] of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `${out}/${name}`, omitBackground: true });
  await page.close();
}
await browser.close();
console.log('icons:', fs.readdirSync(out).join(', '));
