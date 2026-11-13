// Builds the PNG app icons from public/icon.svg. Run after changing the icon: npm run icons
//
//  - pwa-192 / pwa-512 ("any"):   the rounded tile, transparent corners
//  - apple-touch-icon (180):      full-bleed square; iOS rounds it, and fills transparency with black
//  - maskable-512 (Android):      full-bleed square with the art inside the 80% safe zone, since
//                                 launchers crop it to a circle, squircle or teardrop
//
// icon.svg must keep its background as <rect id="bg" … rx="…"> and the artwork inside <g id="art">.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.resolve(__dirname, '../public/icon.svg'), 'utf8');

function variant(svg, { fullBleed = false, artScale = 1 } = {}) {
  let out = svg;
  if (fullBleed) {
    if (!/<rect id="bg"[^>]*\brx="[^"]*"/.test(out)) throw new Error('icon.svg: background rect id="bg" with rx not found');
    out = out.replace(/(<rect id="bg"[^>]*?)\s+rx="[^"]*"/, '$1');
  }
  if (artScale !== 1) {
    if (!out.includes('<g id="art">')) throw new Error('icon.svg: <g id="art"> not found');
    const t = 32 * (1 - artScale); // scale about the centre of the 64×64 viewBox
    out = out.replace('<g id="art">', `<g id="art" transform="translate(${t} ${t}) scale(${artScale})">`);
  }
  return out;
}

const targets = [
  { name: 'pwa-192x192.png', size: 192, svg: variant(source) },
  { name: 'pwa-512x512.png', size: 512, svg: variant(source) },
  { name: 'apple-touch-icon.png', size: 180, svg: variant(source, { fullBleed: true }) },
  // The art spans ~52 of 64 units; 0.8 keeps every part inside the maskable safe circle (radius 40%).
  { name: 'maskable-icon-512x512.png', size: 512, svg: variant(source, { fullBleed: true, artScale: 0.8 }) },
];

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge' });
const page = await browser.newPage();
for (const { name, size, svg } of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">
    <img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size}" height="${size}" style="display:block">
  </body></html>`);
  await page.locator('img').evaluate(img => img.decode());
  await page.screenshot({ path: path.resolve(__dirname, '../public', name), omitBackground: true });
  console.log(`${name} (${size}×${size})`);
}
await browser.close();
