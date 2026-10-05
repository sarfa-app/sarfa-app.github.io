// Растеризация иконок из assets-src/*.svg в public/*.png.
// Нужен Playwright с Chromium: npx playwright install chromium (или глобальный).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node-tools/node_modules/playwright'));
}

const jobs = [
  ['assets-src/icon.svg', 'public/apple-touch-icon.png', 180],
  ['assets-src/icon.svg', 'public/icon-180.png', 180],
  ['assets-src/icon.svg', 'public/icon-192.png', 192],
  ['assets-src/icon.svg', 'public/icon-512.png', 512],
  ['assets-src/icon-maskable.svg', 'public/icon-maskable-512.png', 512],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [src, out, size] of jobs) {
  const svg = readFileSync(src, 'utf8');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: size, height: size }, omitBackground: false });
  console.log('✓', out);
}
await browser.close();
