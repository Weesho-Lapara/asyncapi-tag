import { expect, test } from '@playwright/test';
import { viewersReady } from './helpers.js';

test('renders fully under script-src self and style-src self, with no CSP violations', async ({ page, browserName }) => {
  const cspErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy|CSP/i.test(m.text())) cspErrors.push(m.text());
  });
  const response = await page.goto('/viewer/test/e2e/csp/');
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");
  await viewersReady(page);

  const adeo = page.locator('#csp-quotes');
  await expect(adeo.locator('.op')).toHaveCount(2);
  await expect(adeo.locator('.row').first()).toBeVisible();
  await expect(adeo.locator('.ex')).toHaveCount(2);
  await expect(page.locator('#csp-orders .op')).toHaveCount(2);
  await expect(page.locator('#csp-missing .alert')).toContainText('Could not load');

  // Styles applied: the header background comes from the token, not the UA default.
  const headerBg = await adeo.locator('.header').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(headerBg).not.toBe('rgba(0, 0, 0, 0)');
  // Runtime colour derivation (CSSOM, not inline style attributes) worked.
  const badgeInk = await adeo.locator('.badge').first().evaluate((el) => getComputedStyle(el).color);
  expect(badgeInk).toBe('rgb(255, 255, 255)');
  // The theme toggle still works (constructed stylesheets under CSP).
  await adeo.locator('button[aria-label="Toggle dark theme"]').click();
  await expect(adeo).toHaveAttribute('resolved-theme', 'dark');

  expect(cspErrors, `${browserName} reported CSP violations`).toEqual([]);
});
