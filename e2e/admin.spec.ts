/**
 * E2E tests for the Admin panel (superadmin only).
 *
 * Seeded credentials:
 *   - superadmin / Admin@123  (role: superadmin)
 *   - admin      / admin123   (role: manager)
 */
import { test, expect, type Page } from '@playwright/test';
import { createInviteToken, gqlRequest, loginViaApi, registerViaApi } from './helpers';

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

async function goToAdmin(page: Page) {
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
}

async function waitForUserInAdminApi(
  request: Parameters<typeof gqlRequest>[0],
  adminToken: string,
  username: string,
): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const data = await gqlRequest(
      request,
      `query { adminUsers { username } }`,
      undefined,
      adminToken,
    );
    const users = (data as { data?: { adminUsers?: { username: string }[] } }).data?.adminUsers ?? [];
    if (users.some((u) => u.username === username)) {
      return;
    }
  }
  throw new Error(`Timed out waiting for adminUsers to include ${username}`);
}

// ─── Tests ────────────────────────────────────────────────────

test.describe('Admin Panel', () => {
  test('superadmin can access admin panel', async ({ page }) => {
    await login(page, SUPERADMIN.username, SUPERADMIN.password);
    await goToAdmin(page);

    await expect(
      page.getByRole('heading', { name: 'Admin Panel' }),
    ).toBeVisible({ timeout: 15_000 });

    // Users tab is default — table element visible
    await expect(page.locator('table[aria-label="Users"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('manager is redirected away from admin panel', async ({ page }) => {
    await login(page, MANAGER.username, MANAGER.password);
    await page.goto('/admin');

    // Should NOT see the Admin Panel heading — redirected to dashboard or 404
    await expect(
      page.getByRole('heading', { name: 'Admin Panel' }),
    ).not.toBeVisible({ timeout: 10_000 });
  });

  test('create invitation — URL shown in table', async ({ page }) => {
    await login(page, SUPERADMIN.username, SUPERADMIN.password);
    await goToAdmin(page);

    await expect(
      page.getByRole('heading', { name: 'Admin Panel' }),
    ).toBeVisible({ timeout: 15_000 });

    // Switch to Invitations tab
    await page.getByRole('tab', { name: 'Invitations' }).click();

    // Email input must be present — hard assertion, no skip
    const emailInput = page.getByPlaceholder('colleague@example.com');
    await expect(emailInput).toBeVisible({ timeout: 10_000 });

    // Fill and submit
    const testEmail = `e2e-${Date.now()}@test.com`;
    await emailInput.fill(testEmail);
    await page.getByRole('button', { name: 'Create Invitation' }).click();

    // New invitation row appears
    await expect(page.getByText(testEmail)).toBeVisible({ timeout: 15_000 });

    // Copy URL button is rendered for this invitation
    await expect(
      page.getByRole('button', { name: `Copy invite URL for ${testEmail}` }),
    ).toBeVisible();
  });

  test('change user role — reflected in user table', async ({ page, request }) => {
    const ts = Date.now();
    const targetUsername = `roleflip${ts}`;
    const targetEmail = `roleflip-${ts}@e2e.local`;
    const adminToken = await loginViaApi(request);
    const inviteToken = await createInviteToken(request, adminToken, targetEmail);
    await registerViaApi(request, targetUsername, 'RoleFlip@123', inviteToken);
    await waitForUserInAdminApi(request, adminToken, targetUsername);

    await login(page, SUPERADMIN.username, SUPERADMIN.password);
    await goToAdmin(page);

    // Users table must be present with actual rows
    await expect(page.locator('table[aria-label="Users"]')).toBeVisible({
      timeout: 15_000,
    });

    // Find the deterministic row created for this test.
    const userCell = page.locator('table[aria-label="Users"] td', {
      hasText: new RegExp(`^${targetUsername}$`),
    });

    for (let i = 0; i < 3; i++) {
      if (await userCell.count()) break;
      await page.reload();
      await page.waitForLoadState('networkidle');
    }

    const adminRow = page.locator('tr').filter({ has: userCell });
    await expect(adminRow).toBeVisible({ timeout: 10_000 });

    const roleSelect = adminRow.locator('button[role="combobox"]');
    await expect(roleSelect).toBeVisible({ timeout: 5_000 });

    // New user starts as "User"; toggle to Manager then back to User.
    await roleSelect.click();
    await page.getByRole('option', { name: 'Manager', exact: true }).click();
    await expect(roleSelect).toContainText('Manager', { timeout: 10_000 });

    await roleSelect.click();
    await page.getByRole('option', { name: 'User', exact: true }).click();
    await expect(roleSelect).toContainText('User', { timeout: 10_000 });
  });

  test('add and remove project member', async ({ page }) => {
    await login(page, SUPERADMIN.username, SUPERADMIN.password);
    await goToAdmin(page);

    await expect(
      page.getByRole('heading', { name: 'Admin Panel' }),
    ).toBeVisible({ timeout: 15_000 });

    // Switch to Membership tab
    await page.getByRole('tab', { name: 'Membership' }).click();

    // Select first project
    const projectSelect = page.locator('#proj-select');
    await expect(projectSelect).toBeVisible({ timeout: 10_000 });
    await projectSelect.click();
    await page.getByRole('option').first().click();

    // Members table must appear
    await expect(page.locator('table[aria-label="Project members"]')).toBeVisible({
      timeout: 15_000,
    });

    // Open the add-user dropdown
    const addUserSelect = page.locator('#add-user');
    await addUserSelect.click();
    const options = page.getByRole('option');
    const optionCount = await options.count();

    if (optionCount === 0) {
      await page.keyboard.press('Escape');
      // All users are already members — genuine data constraint, not a bug
      test.skip(true, 'All users are already project members — add another user first');
      return;
    }

    const addedUsername = await options.first().textContent();
    await options.first().click();

    await page.getByRole('button', { name: 'Add selected user to project' }).click();

    await expect(
      page.locator('table[aria-label="Project members"]').getByText(addedUsername!.trim()),
    ).toBeVisible({ timeout: 15_000 });

    // Remove the user
    await page
      .getByRole('button', { name: `Remove ${addedUsername!.trim()} from project` })
      .click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click();

    await expect(
      page.locator('table[aria-label="Project members"]').getByText(addedUsername!.trim()),
    ).not.toBeVisible({ timeout: 10_000 });
  });
});
