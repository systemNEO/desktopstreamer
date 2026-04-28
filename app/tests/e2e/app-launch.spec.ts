import { test, expect, _electron as electron } from '@playwright/test';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('App startet und zeigt alle drei Sections', async () => {
  const app = await electron.launch({
    args: [join(__dirname, '../../out/main/index.js')],
    timeout: 15_000
  });

  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  await expect(window.getByText('Desktopstreamer')).toBeVisible();

  await expect(window.getByText('Was streamen?')).toBeVisible();
  await expect(window.getByText('Wohin streamen?')).toBeVisible();
  await expect(window.getByText('Stream-Kontrolle')).toBeVisible();

  const liveBtn = window.getByRole('button', { name: /stream starten/i });
  await expect(liveBtn).toBeVisible();
  await expect(liveBtn).toBeDisabled();

  await app.close();
});
