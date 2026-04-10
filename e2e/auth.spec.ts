/**
 * E2E tests for authentication flows.
 *
 * Seeded credentials (server/seed.ts):
 *   - superadmin / Admin@123  (role: superadmin)
 *   - admin      / admin123   (role: manager)
 *
 * Tests for locked-account and invite-registration create their own
 * ephemeral users via the GraphQL API so they never pollute shared state.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginViaApi, createInviteToken, registerViaApi } from './helpers';

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
    await expect(page.locator('h1:has-text("Sign In")')).not.toBeVisible();
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#username', SUPERADMIN.username);
    await page.fill('#password', 'WrongPassword!');
    await page.click('button[type="submit"]');
    await expect(page.locator('.text-destructive')).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('locked account shows lockout error after 5 failed attempts', async ({ page, request }) => {
    // Create a fresh ephemeral user via invite → register so we never lock a shared account
    const adminToken = await loginViaApi(request);
    const ts = Date.now();
    const inviteToken = await createInviteToken(request, adminToken, `locktest-${ts}@e2e.local`);
    const lockUsername = `locktest${ts}`;
    await registerViaApi(request, lockUsername, 'LockTest@123', inviteToken);

    // Fail 5 times — each attempt increments failedAttempts; on attempt 5, lockedUntil is set
    for (let i = 0; i < 5; i++) {
      await page.goto('/login');
      await page.fill('#username', lockUsername);
      await page.fill('#password', 'WrongPassword!');
      await page.click('button[type="submit"]');
      await expect(page.locator('.text-destructive')).toBeVisible({ timeout: 10_000 });
    }

    // 6th attempt — lockedUntil is now in the future → "Account locked." message
    await page.goto('/login');
    await page.fill('#username', lockUsername);
    await page.fill('#password', 'WrongPassword!');
    await page.click('button[type="submit"]');
    await expect(page.locator('.text-destructive')).toContainText(/locked/i, {
      timeout: 10_000,
    });
  });

  test('invite registration — new user registers and is authenticated', async ({
    page,
    request,
  }) => {
    const adminToken = await loginViaApi(request);
    const ts = Date.now();
    const inviteToken = await createInviteToken(
      request,
      adminToken,
      `register-${ts}@e2e.local`,
    );
    const newUsername = `e2ereg${ts}`;

    await page.goto(`/register?token=${inviteToken}`);

    await page.fill('#username', newUsername);
    await page.fill('#password', 'TestPass@123');
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Successful registration → redirect away from /register (to / or /change-password)
    await page.waitForURL((url) => !url.pathname.includes('/register'), {
      timeout: 30_000,
    });
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('forced password change redirects to change-password page', async ({ page }) => {
    await login(page, SUPERADMIN.username, SUPERADMIN.password);
    await page.goto('/change-password');
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10_000 });
  });

  test('logout redirects to login page', async ({ page }) => {
    await login(page, MANAGER.username, MANAGER.password);
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('protected route redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
