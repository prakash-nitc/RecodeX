import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.resolve(__dirname, '../public/icon.svg');
const svg = fs.readFileSync(svgPath, 'utf8');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage();

  const sizes = [
    { size: 192, name: 'pwa-192x192.png' },
    { size: 512, name: 'pwa-512x512.png' },
    { size: 180, name: 'apple-touch-icon.png' },
    { size: 512, name: 'maskable-icon-512x512.png', maskable: true },
  ];

  for (const { size, name, maskable } of sizes) {
    const pad = maskable ? Math.round(size * 0.1) : 0;
    const innerSize = size - pad * 2;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              width: ${size}px;
              height: ${size}px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: ${maskable ? '#4F34B0' : 'transparent'};
              overflow: hidden;
            }
            svg {
              width: ${innerSize}px;
              height: ${innerSize}px;
            }
          </style>
        </head>
        <body>
          ${svg}
        </body>
      </html>
    `;
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(html);
    const outPath = path.resolve(__dirname, `../public/${name}`);
    await page.screenshot({ path: outPath, omitBackground: !maskable });
    console.log(`Generated ${name} (${size}x${size})`);
  }

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

