import { test, expect } from '@playwright/test';

// Alle Tests laufen im Demo-Modus (?demo in der Adresse), egal was in js/konfig.js steht.
// Jeder Test bekommt einen frischen Browser-Speicher und damit eine frische Demo.

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo');
  await expect(page.getByRole('heading', { name: 'Heute', level: 1 })).toBeVisible();
});

test('Stimmung wählen bleibt nach dem Neuladen markiert', async ({ page }) => {
  const platt = page.getByRole('button', { name: 'Platt' });
  await platt.click();
  await expect(platt).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Platt' })).toHaveAttribute('aria-pressed', 'true');
});

test('Umarmung schicken zeigt die Bestätigung', async ({ page }) => {
  await page.getByRole('button', { name: 'Umarmung schicken' }).click();
  await expect(page.getByRole('button', { name: 'Umarmung ist unterwegs' })).toBeDisabled();
});

test('Frage des Tages: Antwort deckt beide auf und ist danach fest', async ({ page }) => {
  await page.getByRole('link', { name: /Fragen/ }).first().click();
  const karte = page.getByRole('region', { name: 'Frage von Sie' });
  await expect(karte.getByText('Versteckt, bis du geantwortet hast')).toBeVisible();
  await expect(karte.getByText('Ramen')).toHaveCount(0);

  await karte.getByLabel('Deine Antwort').fill('Lasagne: schwer, aber gut.');
  await karte.getByRole('button', { name: 'Antworten und aufdecken' }).click();

  await expect(karte.getByText('Lasagne: schwer, aber gut.')).toBeVisible();
  await expect(karte.getByText(/Ramen/)).toBeVisible();
  await expect(karte.getByLabel('Deine Antwort')).toHaveCount(0); // kein Ändern mehr möglich
});

test('Eigene Frage stellen: Partnerin antwortet in der Demo', async ({ page }) => {
  await page.goto('/?demo#fragen');
  await page.getByLabel('Deine Frage').first().fill('Welche Superkraft hättest du gern?');
  await page.getByRole('button', { name: 'Frage stellen' }).click();

  const karte = page.getByRole('region', { name: 'Deine Frage' });
  await expect(karte.getByText('Welche Superkraft hättest du gern?')).toBeVisible();
  await karte.getByLabel('Deine Antwort').fill('Teleportieren!');
  await karte.getByRole('button', { name: 'Antworten und aufdecken' }).click();
  await expect(karte.getByText('Aufgedeckt', { exact: true })).toBeVisible({ timeout: 6000 });

  // Danach wartet die Karte für morgen
  await expect(page.getByRole('heading', { name: 'Deine Frage für morgen' })).toBeVisible();
});

test('Was würdest du eher: Wahl zeigt Ergebnis und lässt sich nicht ändern', async ({ page }) => {
  await page.goto('/?demo#eher');
  const optionen = page.locator('.option');
  await optionen.first().click();
  await expect(optionen.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/^(Match!|Uneinig)$/)).toBeVisible();

  await expect(optionen.nth(1)).toHaveAttribute('aria-disabled', 'true');
  await optionen.nth(1).click({ force: true }); // trotzdem klicken: darf nichts ändern
  await expect(optionen.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(optionen.nth(1)).toHaveAttribute('aria-pressed', 'false');
});

test('Archiv zeigt die Fragen der letzten Tage', async ({ page }) => {
  await page.getByRole('link', { name: 'Archiv' }).click();
  await expect(page.getByText('Wenn du ein Tier wärst, welches wärst du?')).toBeVisible();
  await expect(page.getByText(/tagsüber faul/)).toBeVisible();
});

test('Foto des Tages: Kamera-Ablauf, Posten und Tauschen', async ({ page }) => {
  await page.getByRole('link', { name: /Foto des Tages/ }).first().click();
  // Das Foto der Partnerin ist sofort sichtbar
  const ihres = page.getByRole('region', { name: 'Foto von Sie' });
  await expect(ihres.locator('.foto-gross')).toBeVisible();

  await page.getByRole('button', { name: 'Foto machen' }).click();
  const kamera = page.getByRole('dialog', { name: 'Foto des Tages aufnehmen' });
  await expect(kamera.getByRole('button', { name: 'Foto aufnehmen' })).toBeEnabled();
  await kamera.getByRole('button', { name: 'Foto aufnehmen' }).click();
  // Nach Countdown kommt die Vorschau
  await expect(kamera.getByRole('button', { name: 'Posten' })).toBeVisible({ timeout: 10000 });
  await kamera.getByRole('button', { name: 'Posten' }).click();

  const meins = page.getByRole('region', { name: 'Dein Foto' });
  await expect(meins.locator('.foto-gross')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Foto machen' })).toHaveCount(0); // nur ein Foto pro Tag

  // Antippen des kleinen Bildes tauscht groß und klein
  const vorher = await meins.locator('.foto-gross').getAttribute('src');
  await meins.getByRole('button', { name: 'Bilder tauschen' }).click();
  await expect(meins.locator('.foto-gross')).not.toHaveAttribute('src', vorher);
});

test('Foto des Tages: Abbrechen schließt die Kamera ohne zu posten', async ({ page }) => {
  await page.goto('/?demo#foto');
  await page.getByRole('button', { name: 'Foto machen' }).click();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('dialog', { name: 'Foto des Tages aufnehmen' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Foto machen' })).toBeVisible();
});

test('Zeile „Seit … zusammen“ unter Heute und Datum ändern', async ({ page }) => {
  await expect(page.getByText(/^Seit .* zusammen$/)).toBeVisible();
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  // Heute als Datum → „erster gemeinsamer Tag“
  const heute = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
  await page.getByLabel('Zusammen seit').fill(heute);
  await page.locator('form[data-form="zusammen"]').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Heute ist euer erster gemeinsamer Tag 💞')).toBeVisible();
});
