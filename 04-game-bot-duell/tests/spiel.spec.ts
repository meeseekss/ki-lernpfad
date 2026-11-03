import { test, expect, type Page } from '@playwright/test';

const futterPosition = (page: Page) =>
  page.locator('[data-inhalt="futter"]').getAttribute('data-testid');

test('Spiel startet mit Schlange, Futter und 0 Punkten', async ({ page }) => {
  await page.goto('/?modus=bot&seed=42');

  await expect(page.locator('[data-testid^="zelle-"]')).toHaveCount(15 * 15);
  await expect(page.locator('[data-inhalt="kopf"]')).toHaveCount(1);
  await expect(page.locator('[data-inhalt="schlange"]')).toHaveCount(2);
  await expect(page.locator('[data-inhalt="futter"]')).toHaveCount(1);
  await expect(page.getByTestId('punkte')).toHaveText('0');
  await expect(page.getByTestId('game-over')).toBeHidden();
  await expect(page.getByTestId('seed')).toHaveText('42');
});

test('Bot-Modus: ein Schritt pro Pfeiltaste, gleicher Seed → gleiches Futter', async ({ page }) => {
  await page.goto('/?modus=bot&seed=42');
  const ersteFutter = await futterPosition(page);
  await expect(page.getByTestId('zelle-7-4')).toHaveAttribute('data-inhalt', 'kopf');

  // Ohne Taste bewegt sich nichts
  await page.waitForTimeout(400);
  await expect(page.getByTestId('zelle-7-4')).toHaveAttribute('data-inhalt', 'kopf');

  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('zelle-7-5')).toHaveAttribute('data-inhalt', 'kopf');

  await page.reload();
  expect(await futterPosition(page)).toBe(ersteFutter);
});
