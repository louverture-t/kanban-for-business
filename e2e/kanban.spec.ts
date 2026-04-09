/**
 * E2E tests for the Kanban board.
 *
 * Runs against production: https://kanban-for-business.onrender.com
 *
 * Pre-conditions (seeded in MongoDB):
 *   - projectId: 69d3b45bcd85533a008790fe  (name: "kanban")
 *   - superadmin / Admin@123  (superadmin, project member)
 *   - admin      / admin123   (manager, project member)
 */
import { test, expect, type Page } from '@playwright/test';

// ─── Constants ────────────────────────────────────────────────
const PROJECT_ID = '69d3b45bcd85533a008790fe';
const SUPERADMIN = { username: 'superadmin', password: 'Admin@123' };
const TEST_TASK_TITLE = `E2E-test-${Date.now()}`;

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
  await page.goto(`/project/${PROJECT_ID}/kanban`);
  await page.waitForLoadState('networkidle');
}

// ─── Tests ────────────────────────────────────────────────────

test.describe('Kanban Board', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, SUPERADMIN.username, SUPERADMIN.password);
  });

  test('navigate to project Kanban view', async ({ page }) => {
    await goToKanban(page);
    await expect(page.locator('h1', { hasText: 'Kanban Board' })).toBeVisible({
      timeout: 15_000,
    });
    // All 4 columns visible
    for (const label of ['Backlog', 'Active', 'Review', 'Complete']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test('create task via "+" button — task appears in Backlog', async ({ page }) => {
    await goToKanban(page);

    // Click "+" on the Backlog column
    await page
      .getByRole('button', { name: 'Add task to Backlog' })
      .click();

    // Dialog opens with "New Task" title
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole('heading', { name: 'New Task' }),
    ).toBeVisible();

    // Fill title and create
    await page.fill('#task-title', TEST_TASK_TITLE);
    await page.getByRole('button', { name: 'Create Task' }).click();

    // Dialog closes
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

    // Task card appears on the board
    await expect(page.getByText(TEST_TASK_TITLE)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('edit task via click — dialog opens with correct data', async ({ page }) => {
    await goToKanban(page);

    // Wait for board to load with tasks
    await expect(page.locator('h1', { hasText: 'Kanban Board' })).toBeVisible({
      timeout: 15_000,
    });

    // Wait for task cards to render
    const firstCard = page.locator('h3.text-sm.font-medium').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    const cardTitle = await firstCard.textContent();
    await firstCard.click();

    // Edit dialog opens
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole('heading', { name: 'Edit Task' }),
    ).toBeVisible();

    // Title field has the task's title
    await expect(page.locator('#task-title')).toHaveValue(cardTitle!.trim());

    // Close dialog
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('delete task — moves to trash, then restore', async ({ page }) => {
    await goToKanban(page);

    // First create a disposable task
    const trashTaskTitle = `E2E-trash-${Date.now()}`;
    await page
      .getByRole('button', { name: 'Add task to Backlog' })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await page.fill('#task-title', trashTaskTitle);
    await page.getByRole('button', { name: 'Create Task' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(trashTaskTitle)).toBeVisible({ timeout: 15_000 });

    // Click the task to open edit dialog
    await page.getByText(trashTaskTitle).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Click "Move to Trash"
    await page.getByRole('button', { name: 'Move to Trash' }).click();

    // Dialog closes
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

    // Task should no longer be on the main board
    await expect(page.getByText(trashTaskTitle)).not.toBeVisible({ timeout: 5_000 });

    // Open trash panel
    await page.getByRole('button', { name: /Show Trash/i }).click();

    // Task appears in trash
    await expect(page.getByText(trashTaskTitle)).toBeVisible({ timeout: 15_000 });

    // Restore the task
    await page.getByRole('button', { name: 'Restore' }).first().click();

    // Wait for the task to reappear on the main board after restore
    // (Trash panel might close or task might reappear in columns)
    await page.waitForTimeout(2_000);

    // The restored task should be back on the board (re-navigate to ensure fresh view)
    await goToKanban(page);
    await expect(page.getByText(trashTaskTitle)).toBeVisible({ timeout: 15_000 });
  });

  test('archive toggle shows archived tasks', async ({ page }) => {
    await goToKanban(page);

    // Click "Show Archived"
    await page.getByRole('button', { name: /Show Archived/i }).click();

    // Button text changes to "Hide Archived"
    await expect(
      page.getByRole('button', { name: /Hide Archived/i }),
    ).toBeVisible({ timeout: 5_000 });

    // Toggle back
    await page.getByRole('button', { name: /Hide Archived/i }).click();
    await expect(
      page.getByRole('button', { name: /Show Archived/i }),
    ).toBeVisible();
  });

  test('drag task from Backlog to Active — status updates', async ({ page }) => {
    await goToKanban(page);

    // Find a task card in Backlog
    const backlogColumn = page.locator('[data-rfd-droppable-id="backlog"]');
    await expect(backlogColumn).toBeVisible({ timeout: 15_000 });

    const taskCard = backlogColumn.locator('h3').first();
    const taskExists = (await taskCard.count()) > 0;

    if (!taskExists) {
      test.skip(true, 'No tasks in Backlog to drag');
      return;
    }

    const taskTitle = await taskCard.textContent();

    // Use keyboard-based drag: focus the draggable, press Space to lift, Arrow to move, Space to drop
    const draggable = backlogColumn.locator('[data-rfd-draggable-id]').first();
    await draggable.focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    // Verify the task moved to Active column
    const activeColumn = page.locator('[data-rfd-droppable-id="active"]');
    await expect(activeColumn.getByText(taskTitle!.trim())).toBeVisible({
      timeout: 10_000,
    });
  });
});
