/**
 * E2E tests for the Kanban board.
 *
 * Seeded credentials:
 *   - superadmin / Admin@123  (superadmin)
 *
 * The project ID is resolved dynamically in beforeAll: the first accessible
 * project is reused; if the local DB is fresh, a test project is auto-created.
 *
 * Day 5 coverage (7 tests):
 *   navigate, create task, edit task, delete task, restore task,
 *   archive toggle, drag task
 */
import { test, expect, type Page } from '@playwright/test';
import { loginViaApi, getOrCreateProjectId } from './helpers';

// ─── State (set in beforeAll) ─────────────────────────────────
let projectId: string;

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

async function goToKanban(page: Page) {
  await page.goto(`/project/${projectId}/kanban`);
  await page.waitForLoadState('networkidle');
}

/** Create a disposable task via the UI and return its title. */
async function createTask(page: Page, title: string) {
  await page.getByRole('button', { name: 'Add task to Backlog' }).click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  await page.fill('#task-title', title);
  await page.getByRole('button', { name: 'Create Task' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });
}

// ─── Tests ────────────────────────────────────────────────────

test.describe('Kanban Board', () => {
  test.beforeAll(async ({ request }) => {
    const token = await loginViaApi(request);
    projectId = await getOrCreateProjectId(request, token);
  });

  test.beforeEach(async ({ page }) => {
    await login(page, SUPERADMIN.username, SUPERADMIN.password);
  });

  test('navigate to project Kanban view', async ({ page }) => {
    await goToKanban(page);
    await expect(page.locator('h1', { hasText: 'Kanban Board' })).toBeVisible({
      timeout: 15_000,
    });
    for (const label of ['Backlog', 'Active', 'Review', 'Complete']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test('create task via "+" button — task appears in Backlog', async ({ page }) => {
    await goToKanban(page);
    const taskTitle = `E2E-test-${Date.now()}`;

    await page.getByRole('button', { name: 'Add task to Backlog' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('heading', { name: 'New Task' })).toBeVisible();

    await page.fill('#task-title', taskTitle);
    await page.getByRole('button', { name: 'Create Task' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 15_000 });
  });

  test('edit task via click — dialog opens with correct data', async ({ page }) => {
    await goToKanban(page);
    await expect(page.locator('h1', { hasText: 'Kanban Board' })).toBeVisible({
      timeout: 15_000,
    });

    const firstCard = page.locator('h3.text-sm.font-medium').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    const cardTitle = await firstCard.textContent();
    await firstCard.click();

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('heading', { name: 'Edit Task' })).toBeVisible();
    await expect(page.locator('#task-title')).toHaveValue(cardTitle!.trim());

    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('delete task — task moves to trash and disappears from board', async ({ page }) => {
    await goToKanban(page);
    const title = `E2E-trash-${Date.now()}`;
    await createTask(page, title);

    await page.getByText(title).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Move to Trash' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

    // Task is gone from the main board
    await expect(page.getByText(title)).not.toBeVisible({ timeout: 5_000 });

    // Task appears in the trash panel
    await page.getByRole('button', { name: /Show Trash/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });
  });

  test('restore task from trash — task returns to board', async ({ page }) => {
    await goToKanban(page);
    const title = `E2E-restore-${Date.now()}`;
    await createTask(page, title);

    // Send to trash first
    await page.getByText(title).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Move to Trash' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

    // Open trash panel and restore
    await page.getByRole('button', { name: /Show Trash/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Restore' }).first().click();
    await page.waitForTimeout(2_000);

    // Re-navigate to confirm the task is back on the board
    await goToKanban(page);
    await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });
  });

  test('archive toggle shows archived tasks', async ({ page }) => {
    await goToKanban(page);

    await page.getByRole('button', { name: /Show Archived/i }).click();
    await expect(
      page.getByRole('button', { name: /Hide Archived/i }),
    ).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: /Hide Archived/i }).click();
    await expect(
      page.getByRole('button', { name: /Show Archived/i }),
    ).toBeVisible();
  });

  test('drag task from Backlog to Active — status updates', async ({ page }) => {
    await goToKanban(page);

    // Create a dedicated task so the test is self-contained
    const dragTitle = `E2E-drag-${Date.now()}`;
    await createTask(page, dragTitle);

    // Keyboard-based drag: focus the card → Space → ArrowRight → Space
    const backlogColumn = page.locator('[data-rfd-droppable-id="backlog"]');
    await expect(backlogColumn).toBeVisible({ timeout: 10_000 });

    const draggable = backlogColumn
      .locator('[data-rfd-draggable-id]')
      .filter({ hasText: dragTitle });
    await draggable.focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    const activeColumn = page.locator('[data-rfd-droppable-id="active"]');
    await expect(activeColumn.getByText(dragTitle)).toBeVisible({ timeout: 10_000 });
  });
});
