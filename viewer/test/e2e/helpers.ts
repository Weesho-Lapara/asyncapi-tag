import type { Page } from '@playwright/test';

/** Wait until every viewer on the page has a model or a load error rendered. */
export async function viewersReady(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    [...document.querySelectorAll('asyncapi-viewer')].every((e) => {
      const el = e as HTMLElement & { model?: unknown; loadResult?: { ok: boolean } };
      return el.model !== undefined || (el.loadResult !== undefined && !el.loadResult.ok);
    }),
  );
  // Let the runtime colour derivation and fonts settle.
  await page.waitForTimeout(200);
}
