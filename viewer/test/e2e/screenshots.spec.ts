import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { viewersReady } from './helpers.js';

/**
 * Captures the demo documents at the three container widths in both themes. The files land in
 * test/e2e/screenshots/<browser>/ (ignored by git, uploaded as a CI artifact) for eyeballing;
 * pixel comparison across platforms is not attempted, so the assertions are structural.
 */
const docs = [
  ['anyof', '/viewer/demo/spec-examples/anyof-asyncapi.yml'],
  ['adeo', '/viewer/demo/spec-examples/adeo-kafka-request-reply-asyncapi.yml'],
  ['kraken', '/viewer/demo/spec-examples/kraken-websocket-request-reply-message-filter-in-reply-asyncapi.yml'],
  ['gitter', '/viewer/demo/spec-examples/gitter-streaming-asyncapi.yml'],
  ['orders', '/docs/examples/orders-v3.yaml'],
  ['accounts', '/docs/examples/accounts-v2.json'],
] as const;
const widths = [1280, 820, 380] as const;
const themes = ['light', 'dark'] as const;

for (const [name, src] of docs) {
  for (const width of widths) {
    for (const theme of themes) {
      test(`${name} at ${width}px ${theme}`, async ({ page, browserName }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto('/viewer/test/e2e/blank.html');
        await page.evaluate(
          ([source, mode]) => {
            document.documentElement.dataset['theme'] = mode;
            const el = document.createElement('asyncapi-viewer');
            el.setAttribute('src', source);
            el.setAttribute('sidebar', '');
            el.setAttribute('theme-toggle', '');
            document.body.appendChild(el);
          },
          [src, theme] as const,
        );
        await viewersReady(page);
        const viewer = page.locator('asyncapi-viewer');
        await expect(viewer).toHaveAttribute('resolved-theme', theme);
        expect(await viewer.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        await expect(viewer.locator('.op').first()).toBeVisible();
        const dir = `test/e2e/screenshots/${browserName}`;
        mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: `${dir}/${name}-${width}-${theme}.png`, fullPage: true });
      });
    }
  }
}
