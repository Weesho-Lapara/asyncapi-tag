import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { viewersReady } from './helpers.js';

const widths = [1280, 380] as const;
const themes = ['light', 'dark'] as const;
const docs = [
  ['adeo', '../../docs/examples/adeo-kafka-request-reply.yaml'],
  ['orders', '../../docs/examples/orders-v3.yaml'],
  ['accounts', '../../docs/examples/accounts-v2.json'],
] as const;

for (const [name, doc] of docs) {
  for (const width of widths) {
    for (const theme of themes) {
      test(`${name} has no serious or critical axe violations at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/viewer/demo/?doc=${encodeURIComponent(doc)}`);
      await viewersReady(page);
      if (theme === 'dark') {
        await page.evaluate(() => {
          document.documentElement.dataset['theme'] = 'dark';
        });
        await page.waitForTimeout(200);
      }
      // Open the first viewer's sidebar drawer on the narrow width so it is checked too.
      if (width === 380) {
        await page.locator('asyncapi-viewer').first().locator('.menu').click();
        await page.waitForTimeout(200);
      }
      const results = await new AxeBuilder({ page }).include('asyncapi-viewer').analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(
        serious.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n  ')}`).join('\n'),
      ).toBe('');
      });
    }
  }
}

test('keyboard: tree toggles, tabs and the drawer are operable', async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 900 });
  await page.goto('/viewer/demo/?doc=' + encodeURIComponent('../../docs/examples/orders-v3.yaml'));
  await viewersReady(page);
  const viewer = page.locator('asyncapi-viewer').first();
  await viewer.locator('.menu').focus();
  await page.keyboard.press('Enter');
  await expect(viewer.locator('.side__search')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(viewer.locator('.menu')).toBeFocused();
  const toggle = viewer.locator('.row__toggle').first();
  await toggle.focus();
  const before = await toggle.getAttribute('aria-expanded');
  await page.keyboard.press('Space');
  expect(await toggle.getAttribute('aria-expanded')).not.toBe(before);
});
