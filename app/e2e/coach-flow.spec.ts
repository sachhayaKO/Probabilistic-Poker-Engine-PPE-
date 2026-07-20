import { test, expect, type Page } from '@playwright/test';

// Steps through hero's decisions — preferring the fold hotkey, falling back
// to call/check when fold isn't legal (e.g. big blind facing a limp) — until
// the hand ends and the ribbon's graded review (Replay Theater button) appears.
async function playHandAndWaitForReview(page: Page) {
  const foldBtn = page.getByRole('button', { name: 'Fold' });
  const replayBtn = page.getByRole('button', { name: /Replay Theater/ });

  for (let step = 0; step < 8; step += 1) {
    await expect(foldBtn.or(replayBtn).first()).toBeVisible({ timeout: 20000 });
    if (await replayBtn.isVisible()) return;
    if (await foldBtn.isEnabled()) {
      await page.keyboard.press('f');
    } else {
      await page.keyboard.press('c');
    }
  }

  await expect(replayBtn).toBeVisible({ timeout: 20000 });
}

test('coach feed -> training session -> ribbon review -> leave -> report card', async ({ page }) => {
  await page.goto('/');

  // a. Coach Feed visible (welcome copy or a coach card — either is fine on a fresh profile).
  await expect(page.getByRole('heading', { name: /Probabilistic Poker Engine/ })).toBeVisible();
  await expect(
    page.getByText(/Welcome to the tables|leaks big enough to name yet|Your biggest leak/).first(),
  ).toBeVisible({ timeout: 15000 });

  // b. Start a Training session vs The Balanced Player via the play controls.
  await page.getByRole('radio', { name: 'Training' }).check();
  await page.getByLabel('Persona').selectOption('balanced');
  await page.getByRole('button', { name: 'Deal In' }).click();

  // Table visible.
  await expect(page.getByRole('button', { name: 'Leave table' })).toBeVisible({ timeout: 15000 });

  // c. Play ~3 hands with the fold hotkey, waiting for the ribbon's graded review each time.
  for (let i = 0; i < 3; i += 1) {
    await playHandAndWaitForReview(page);
    await page.keyboard.press('n');
  }

  // d. Leave the table -> Coach Feed again, with no full page reload.
  await page.evaluate(() => {
    (window as unknown as { __ppeE2EMarker?: string }).__ppeE2EMarker = 'still-here';
  });
  await page.getByRole('button', { name: 'Leave table' }).click();

  await expect(page.getByRole('heading', { name: /Probabilistic Poker Engine/ })).toBeVisible({
    timeout: 15000,
  });
  const marker = await page.evaluate(
    () => (window as unknown as { __ppeE2EMarker?: string }).__ppeE2EMarker,
  );
  expect(marker).toBe('still-here');

  // e. Open Report Card -> "hands graded" reflects at least 1; return home.
  await page.getByRole('button', { name: 'Report Card' }).click();
  await expect(page.getByRole('heading', { name: 'Report Card' })).toBeVisible();

  const handsGradedLabel = page.getByText('hands graded', { exact: false });
  await expect(handsGradedLabel).toBeVisible({ timeout: 15000 });
  const tileText = await handsGradedLabel.locator('..').innerText();
  expect(tileText).toMatch(/[1-9]\d*\s*hands graded/i);

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: /Probabilistic Poker Engine/ })).toBeVisible();
});
