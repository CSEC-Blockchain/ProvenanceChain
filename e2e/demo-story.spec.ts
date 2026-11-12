import { test, expect } from '@playwright/test';

test.describe('ProvenanceChain End-to-End Suite', () => {
  test('1. Landing page loads without requiring any wallet or crypto', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Tamper-Proof Product Authenticity');
    await expect(page.locator('text=On-Chain Authenticity')).toBeVisible();

    // Verify quick demo links
    await expect(page.locator('a:has-text("Try Demo Scan (Authentic Batch #1)")')).toBeVisible();
    await expect(page.locator('a:has-text("Try Recalled Scan (Batch #3)")')).toBeVisible();
  });

  test('2. Consumer scan of authentic Batch #1 reads full 3-step chain directly on-chain', async ({ page }) => {
    await page.goto('/v/1');

    // Big verdict badge
    await expect(page.locator('span:has-text("VERIFIED AUTHENTIC")')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Genuine Product Guaranteed' })).toBeVisible();

    // Product Card
    await expect(page.locator('text=Batch #1')).toBeVisible();
    await expect(page.locator('text=Sidama Single Origin Heirloom')).toBeVisible();
    await expect(page.locator('text=Sidama, Ethiopia')).toBeVisible();

    // 3-step chronological custody history
    await expect(page.locator('text=On-Chain Custody Audit Trail')).toBeVisible();
    await expect(page.locator('text=Batch Created & Registered')).toBeVisible();
    await expect(page.locator('text=Custody Transfer #1')).toBeVisible();
    await expect(page.locator('text=Custody Transfer #2')).toBeVisible();

    // Complete custody status
    await expect(page.locator('text=Unbroken Producer-to-Shop Custody Verified')).toBeVisible();
    await expect(page.locator('text=100% Complete')).toBeVisible();
  });

  test('3. Consumer scan of Batch #2 flags Caution for incomplete custody (stuck at Producer)', async ({ page }) => {
    await page.goto('/v/2');
    await expect(page.locator('span:has-text("CAUTION ADVISED")')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Custody Incomplete / In Transit' })).toBeVisible();
    await expect(page.locator('text=Batch is still registered at the producer site')).toBeVisible();
  });

  test('4. Consumer scan of Batch #3 displays active safety recall alert', async ({ page }) => {
    await page.goto('/v/3');
    await expect(page.locator('span:has-text("SAFETY ALERT: RECALLED")')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Product Recall Issued' })).toBeVisible();
    await expect(page.locator('text=This product batch has been officially RECALLED')).toBeVisible();
  });

  test('5. Unregistered Batch #999 displays counterfeit warning', async ({ page }) => {
    await page.goto('/v/999');
    await expect(page.locator('span:has-text("COUNTERFEIT WARNING")')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Unrecognized Product Code' })).toBeVisible();
    await expect(page.locator('text=This product batch ID does not exist in the blockchain provenance registry')).toBeVisible();
  });

  test('6. Role portals render with MetaMask connect guards and role detection', async ({ page }) => {
    // Producer portal
    await page.goto('/producer');
    await expect(page.locator('h1')).toContainText('Producer Management Portal');
    await expect(page.locator('text=MetaMask Wallet Required')).toBeVisible();

    // Distributor portal
    await page.goto('/distributor');
    await expect(page.locator('h1')).toContainText('Distributor Portal');
    await expect(page.locator('text=MetaMask Wallet Required')).toBeVisible();

    // Shop portal
    await page.goto('/shop');
    await expect(page.locator('h1')).toContainText('Retail Shop Portal');
    await expect(page.locator('text=MetaMask Wallet Required')).toBeVisible();

    // Admin portal
    await page.goto('/admin');
    await expect(page.locator('h1')).toContainText('Platform Administration');
    await expect(page.locator('text=Admin Wallet Required')).toBeVisible();
  });
});
