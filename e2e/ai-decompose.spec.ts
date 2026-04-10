/**
 * E2E tests for the AI Decompose dialog (task 4.4).
 *
 * Pre-conditions (seeded once in MongoDB, not created at runtime to avoid rate-limiter):
 *   - projectId:    69d3b45bcd85533a008790fe  (name: "kanban", admin is member)
 *   - manager:      admin / admin123           (role: manager, project member)
 *   - regular user: e2e_regular_user / Test@E2E!99  (role: user, project member)
 */
import { test, expect, type Page } from '@playwright/test';

// ─── Constants ────────────────────────────────────────────────
const PROJECT_ID = '69d3b45bcd85533a008790fe';
const MANAGER = { username: 'admin', password: 'admin123' };
const REGULAR = { username: 'e2e_regular_user', password: 'Test@E2E!99' };

// ─── Helpers ──────────────────────────────────────────────────

async function login(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
}

async function goToKanban(page: Page) {
  await page.goto(`/project/${PROJECT_ID}/kanban`);
  await page.waitForLoadState('networkidle');
}

/** Mock the AI GraphQL mutations so tests never call OpenRouter */
async function mockAiMutations(page: Page) {
  await page.route('**/graphql', async (route) => {
    const body = route.request().postDataJSON() as { query?: string };
    const q = body.query ?? '';

    if (q.includes('AiDecompose')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            aiDecompose: [
              { title: 'Draft billing audit plan', description: 'Review current billing workflows', priority: 'high', dueDate: null, assigneeId: null },
              { title: 'Schedule staff training', description: 'Coordinate with HR for training dates', priority: 'medium', dueDate: null, assigneeId: null },
            ],
          },
        }),
      });
    } else if (q.includes('AiConfirmDecomposition')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            aiConfirmDecomposition: [
              { _id: 'mock-1', title: 'Draft billing audit plan', status: 'todo', priority: 'high' },
              { _id: 'mock-2', title: 'Schedule staff training', status: 'todo', priority: 'medium' },
            ],
          },
        }),
      });
    } else {
      await route.continue();
    }
  });
}

// ─── Tests ────────────────────────────────────────────────────

test.describe('AI Decompose dialog', () => {

  test('manager sees the AI Decompose button on the kanban board', async ({ page }) => {
    await login(page, MANAGER.username, MANAGER.password);
    await goToKanban(page);
    await expect(page.getByRole('button', { name: 'AI Decompose', exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('regular user does NOT see the AI Decompose button', async ({ page }) => {
    await login(page, REGULAR.username, REGULAR.password);
    await goToKanban(page);
    await expect(page.getByRole('button', { name: 'AI Decompose', exact: true })).not.toBeVisible();
  });

  test('manager can paste text, analyze, edit tasks, and confirm creation', async ({ page }) => {
    await mockAiMutations(page);
    await login(page, MANAGER.username, MANAGER.password);
    await goToKanban(page);

    // Open dialog
    await page.getByRole('button', { name: 'AI Decompose', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Step 1 — paste text
    const textarea = page.getByRole('dialog').getByRole('textbox').first();
    await textarea.fill('Plan our Q2 billing audit and staff training rollout');
    await expect(textarea).toHaveValue(/billing audit/);

    // Analyze
    await page.getByRole('dialog').getByRole('button', { name: 'Analyze' }).click();

    // Step 2 — preview cards appear (assert on structure, not mock text)
    const titleInputs_step2 = page.getByRole('dialog').getByPlaceholder('Task title');
    await expect(titleInputs_step2).toHaveCount(2, { timeout: 10_000 });

    // Edit first task title
    await titleInputs_step2.first().fill('Revised billing audit plan');
    await expect(titleInputs_step2.first()).toHaveValue('Revised billing audit plan');

    // Add a new task
    await page.getByRole('dialog').getByRole('button', { name: 'Add Task' }).click();
    await expect(page.getByRole('dialog').getByPlaceholder('Task title')).toHaveCount(3);

    // Fill the new blank task title (Confirm stays disabled until all titles filled)
    await page.getByRole('dialog').getByPlaceholder('Task title').last().fill('New manual task');

    // Remove the second task
    await page.getByRole('dialog').getByRole('button', { name: 'Remove task 2' }).click();
    await expect(page.getByRole('dialog').getByPlaceholder('Task title')).toHaveCount(2);

    // Confirm
    await page.getByRole('dialog').getByRole('button', { name: /Create \d+ Tasks?/ }).click();

    // Toast appears
    await expect(page.getByText(/tasks? created/i)).toBeVisible({ timeout: 8_000 });

    // Dialog closes
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
  });

  test('Confirm button is disabled when a task title is empty', async ({ page }) => {
    await mockAiMutations(page);
    await login(page, MANAGER.username, MANAGER.password);
    await goToKanban(page);

    await page.getByRole('button', { name: 'AI Decompose', exact: true }).click();
    await page.getByRole('dialog').getByRole('textbox').first().fill('test input');
    await page.getByRole('dialog').getByRole('button', { name: 'Analyze' }).click();

    // Wait for preview cards (assert on structure, not mock text)
    await expect(page.getByRole('dialog').getByPlaceholder('Task title')).toHaveCount(2, { timeout: 10_000 });

    // Add a blank task — Confirm must become disabled
    await page.getByRole('dialog').getByRole('button', { name: 'Add Task' }).click();
    const confirmBtn = page.getByRole('dialog').getByRole('button', { name: /Create \d+ Tasks?/ });
    await expect(confirmBtn).toBeDisabled();
  });

  test('Cancel button closes the dialog and resets state', async ({ page }) => {
    await login(page, MANAGER.username, MANAGER.password);
    await goToKanban(page);

    await page.getByRole('button', { name: 'AI Decompose', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('dialog').getByRole('textbox').first().fill('some text');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Re-open — textarea must be empty (state reset)
    await page.getByRole('button', { name: 'AI Decompose', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('textbox').first()).toHaveValue('');
  });
});
