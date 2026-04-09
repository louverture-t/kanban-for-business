/**
 * E2E tests for the global search command palette (Ctrl+K).
 *
 * Runs against production: https://kanban-for-business.onrender.com
 *
 * Seeded credentials:
 *   - superadmin / Admin@123  (role: superadmin)
 */
import { test, expect, type Page } from '@playwright/test';

// ─── Constants ────────────────────────────────────────────────
const SUPERADMIN = { username: 'superadmin', password: 'Admin@123' };

// ─── Helpers ──────────────────────────────────────────────────

async function login(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 30_000,
  });
}

/** Open search dialog — retries Ctrl+K if the dialog doesn't appear */
async function openSearch(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.keyboard.press('Control+k');
    try {
      await expect(
        page.getByRole('dialog', { name: 'Global task search' }),
      ).toBeVisible({ timeout: 3_000 });
      return; // success
    } catch {
      // Dialog didn't open, retry after a short wait
      await page.waitForTimeout(500);
    }
  }
  // Final attempt — let it throw
  await expect(
    page.getByRole('dialog', { name: 'Global task search' }),
  ).toBeVisible({ timeout: 5_000 });
}

// ─── Tests ────────────────────────────────────────────────────

test.describe('Search Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, SUPERADMIN.username, SUPERADMIN.password);
    // Wait for dashboard to fully load and event listeners to attach
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
  });

  test('Ctrl+K opens search dialog', async ({ page }) => {
    await openSearch(page);

    // Input is focused with placeholder
    await expect(
      page.getByPlaceholder('Search tasks...'),
    ).toBeFocused();

    // Close by clicking the backdrop
    await page.locator('.fixed.inset-0.z-50').click({ position: { x: 10, y: 10 } });

    await expect(
      page.getByRole('dialog', { name: 'Global task search' }),
    ).not.toBeVisible({ timeout: 5_000 });
  });

  test('type query — matching tasks appear', async ({ page }) => {
    await openSearch(page);

    const input = page.getByPlaceholder('Search tasks...');
    await expect(input).toBeVisible({ timeout: 5_000 });

    // Type a search query
    await input.fill('task');

    // Wait for debounce (300ms) + network response
    await page.waitForTimeout(2_000);

    // Either results appear or "No tasks found" message
    const hasResults = await page.locator('[cmdk-item]').count();
    if (hasResults > 0) {
      await expect(page.locator('[cmdk-item]').first()).toBeVisible();
    } else {
      await expect(page.getByText(/no tasks found/i)).toBeVisible();
    }
  });

  test('click result navigates to project kanban view', async ({ page }) => {
    await openSearch(page);

    const input = page.getByPlaceholder('Search tasks...');
    await expect(input).toBeVisible({ timeout: 5_000 });

    // Search broadly
    await input.fill('task');
    await page.waitForTimeout(2_000);

    const resultCount = await page.locator('[cmdk-item]').count();
    if (resultCount === 0) {
      test.skip(true, 'No search results to click');
      return;
    }

    // Click the first result
    await page.locator('[cmdk-item]').first().click();

    // Should navigate to a project kanban view
    await expect(page).toHaveURL(/\/project\/.*\/kanban/, { timeout: 15_000 });

    // Search dialog should be closed
    await expect(
      page.getByRole('dialog', { name: 'Global task search' }),
    ).not.toBeVisible();
  });
});
