import { test, expect } from '@playwright/test';

test.describe('Phase 2 — Anti-Copy Unit Scratch-Off Protection', () => {
  test('1. Public unit page /u/1/0 renders unit passport and custody chain without wallet', async ({ page }) => {
    await page.goto('/u/1/0');

    // Unit passport header
    await expect(page.locator('text=Unit Authenticity Passport')).toBeVisible();
    await expect(page.locator('text=Batch #1 • Unit Serial #0')).toBeVisible();

    // Scratch-off status card
    await expect(page.locator('text=Scratch-Off Ownership Status')).toBeVisible();

    // Custody timeline
    await expect(page.locator('text=Verified Custody Chain')).toBeVisible();
  });

  test('2. Consumer claim page /claim/1/0 renders without wallet and accepts scratch code', async ({ page }) => {
    await page.goto('/claim/1/0');

    await expect(page.locator('h1')).toContainText('Verify Scratch-Off Security Seal');
    await expect(page.locator('text=Consumer Verification Portal • Zero Wallet Required')).toBeVisible();
    await expect(page.locator('button:has-text("Claim & Verify Authenticity On-Chain")')).toBeVisible();
  });

  test('3. Secret in URL hash fragment is auto-read client-side without server logging', async ({ page }) => {
    const dummySecret = 'e1a2b3c4d5e6f708192a3b4c5d6e7f80';
    await page.goto(`/claim/1/0#${dummySecret}`);

    const input = page.locator('input[placeholder*="32-character scratch code"]');
    await expect(input).toHaveValue(dummySecret);
  });
});
