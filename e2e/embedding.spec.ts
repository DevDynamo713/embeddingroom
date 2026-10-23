import { test, expect } from '@playwright/test';
test('embeddingroom loads and adds embedding', async ({ page }) => {
  await page.goto('http://localhost:3000/room/demo');
  await expect(page.locator('h1')).toContainText('EmbeddingRoom: demo');
  await page.locator('.text-input').fill('The quick brown fox jumps over the lazy dog');
  await page.locator('.source-input').fill('wiki');
  await page.locator('.add-btn').click();
  await expect(page.locator('.embedding-list').locator('div').first()).toBeVisible();
});
test('embeddingroom search returns results', async ({ page }) => {
  await page.goto('http://localhost:3000/room/demo');
  await page.locator('.text-input').fill('machine learning');
  await page.locator('.source-input').fill('test');
  await page.locator('.add-btn').click();
  await page.locator('.query-input').fill('machine learning');
  await page.locator('.search-btn').click();
  await expect(page.locator('.results-list')).toBeVisible();
});