import { expect, test } from '@playwright/test';

test('pressing Enter in the mental thread title creates the thread', async ({ page }) => {
    await page.goto('/browser-tests/mental-thread-create.html');
    await page.getByRole('button', { name: 'New thread' }).click();

    const title = page.getByRole('textbox', { name: 'What is occupying your mind?' });
    await title.fill('Plan a quiet weekend');
    await title.press('Enter');

    await expect(page.getByTestId('created-count')).toHaveText('Created: 1');
    await expect(page.getByRole('dialog')).toBeHidden();
});

test('pressing Enter in multiline context keeps its newline without submitting', async ({ page }) => {
    await page.goto('/browser-tests/mental-thread-create.html');
    await page.getByRole('button', { name: 'New thread' }).click();

    const title = page.getByRole('textbox', { name: 'What is occupying your mind?' });
    await title.fill('Plan a quiet weekend');
    const context = page.getByRole('textbox', { name: 'Context' });
    await context.fill('First line');
    await context.press('Enter');

    await expect(context).toHaveValue('First line\n');
    await expect(page.getByTestId('created-count')).toHaveText('Created: 0');
});
