/**
 * E2E tests for the global search command palette (Ctrl+K).
 *
 * Seeded credentials:
 *   - superadmin / Admin@123  (role: superadmin)
 *
 * beforeAll creates a known fixture task so search results are guaranteed
 * even on a fresh local database.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginViaApi, getOrCreateProjectId, createTaskViaApi } from './helpers';

// ─── Constants ────────────────────────────────────────────────
const SUPERADMIN = { username: 'superadmin', password: 'Admin@123' };

// ─── State (set in beforeAll) ─────────────────────────────────
let searchFixtureTitle: string;

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
      return;
    } catch {
      await page.waitForTimeout(500);
    }
  }
  // Final attempt — let it throw naturally
  await expect(
    page.getByRole('dialog', { name: 'Global task search' }),
  ).toBeVisible({ timeout: 5_000 });
}

// ─── Tests ────────────────────────────────────────────────────

test.describe('Search Command Palette', () => {
  test.beforeAll(async ({ request }) => {
    // Create a fixture task with a unique title so searches always return results
    const token = await loginViaApi(request);
    const pid = await getOrCreateProjectId(request, token);
    searchFixtureTitle = `e2e-search-${Date.now()}`;
    await createTaskViaApi(request, token, pid, searchFixtureTitle);
  });

  test.beforeEach(async ({ page }) => {
    await login(page, SUPERADMIN.username, SUPERADMIN.password);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
  });

  test('Ctrl+K opens search dialog', async ({ page }) => {
    await openSearch(page);

    await expect(page.getByPlaceholder('Search tasks...')).toBeFocused();

    // Close via backdrop click
    await page.locator('.fixed.inset-0.z-50').click({ position: { x: 10, y: 10 } });
    await expect(
      page.getByRole('dialog', { name: 'Global task search' }),
    ).not.toBeVisible({ timeout: 5_000 });
  });

  test('type query — matching tasks appear', async ({ page }) => {
    await openSearch(page);

    const input = page.getByPlaceholder('Search tasks...');
    await expect(input).toBeVisible({ timeout: 5_000 });

    // Search for the fixture task — guaranteed to exist
    await input.fill(searchFixtureTitle);
    await page.waitForTimeout(2_000); // debounce + network

    await expect(page.locator('[cmdk-item]').first()).toBeVisible({ timeout: 5_000 });
  });

  test('click result navigates to project kanban view', async ({ page }) => {
    await openSearch(page);

    const input = page.getByPlaceholder('Search tasks...');
    await expect(input).toBeVisible({ timeout: 5_000 });

    await input.fill(searchFixtureTitle);
    await page.waitForTimeout(2_000);

    // Fixture task guarantees at least one result
    const firstResult = page.locator('[cmdk-item]').first();
    await expect(firstResult).toBeVisible({ timeout: 5_000 });
    await firstResult.click();

    await expect(page).toHaveURL(/\/project\/.*\/kanban/, { timeout: 15_000 });
    await expect(
      page.getByRole('dialog', { name: 'Global task search' }),
    ).not.toBeVisible();
  });
});
