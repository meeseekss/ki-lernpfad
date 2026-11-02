import { test, expect } from '@playwright/test';

test('zwei Todos anlegen und eins abhaken', async ({ page }) => {
  await page.goto('https://demo.playwright.dev/todomvc/#/');

  const eingabe = page.getByRole('textbox', { name: 'What needs to be done?' });

  await eingabe.fill('Milch einkaufen');
  await eingabe.press('Enter');
  await eingabe.fill('Jogurt einkaufen');
  await eingabe.press('Enter');

  await page
    .getByRole('listitem')
    .filter({ hasText: 'Milch einkaufen' })
    .getByLabel('Toggle Todo')
    .check();

  await expect(page.getByTestId('todo-title')).toHaveCount(2);
  await expect(page.getByText('1 item left')).toBeVisible();
});