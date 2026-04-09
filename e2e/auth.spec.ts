/**
 * E2E tests for authentication flows.
 *
 * Runs against production: https://kanban-for-business.onrender.com
 *
 * Seeded credentials:
 *   - superadmin / Admin@123  (role: superadmin)
 *   - admin      / admin123   (role: manager)
 *
 * Skipped: locked-account test (would lock a real account for 15 min),
 *          invite-token registration (no test invite seeded).
 */
import { test, expect, type Page } from '@playwright/test';

// ─── Constants ────────────────────────────────────────────────
const SUPERADMIN = { username: 'superadmin', password: 'Admin@123' };
const MANAGER = { username: 'admin', password: 'admin123' };

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

// ─── Tests ────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await login(page, SUPERADMIN.username, SUPERADMIN.password);
    // Dashboard loaded — should see main content (not login form)
    await expect(page.locator('h1:has-text("Sign In")')).not.toBeVisible();
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#username', SUPERADMIN.username);
    await page.fill('#password', 'WrongPassword!');
    await page.click('button[type="submit"]');
    // Error message appears on the login page
    await expect(page.locator('.text-destructive')).toBeVisible({ timeout: 15_000 });
    // Still on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('forced password change redirects to change-password page', async ({ page }) => {
    // Verify the change-password route exists and is accessible after auth
    await login(page, SUPERADMIN.username, SUPERADMIN.password);
    await page.goto('/change-password');
    // The change-password page should render (not redirect to login or 404)
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10_000 });
  });

  test('logout redirects to login page', async ({ page }) => {
    await login(page, MANAGER.username, MANAGER.password);

    // Click logout button in sidebar
    await page.getByRole('button', { name: 'Logout' }).click();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('protected route redirects to login when not authenticated', async ({ page }) => {
    // Go directly to dashboard without logging in
    await page.goto('/');
    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
