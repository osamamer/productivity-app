import { expect, test } from '@playwright/test';

test('a typed schedule time saves only after it is accepted', async ({ page }) => {
    await page.goto('/browser-tests/task-schedule.html');

    await page.getByRole('spinbutton', { name: 'hours' }).click();
    await page.getByRole('spinbutton', { name: 'hours' }).press('1');
    await page.getByRole('spinbutton', { name: 'hours' }).press('4');
    await page.getByRole('spinbutton', { name: 'minutes' }).click();
    await page.getByRole('spinbutton', { name: 'minutes' }).press('3');
    await page.getByRole('spinbutton', { name: 'minutes' }).press('0');

    await expect(page.getByTestId('saved-schedule')).toHaveText('Saved: 09:00');
    await expect(page.getByTestId('schedule-save-count')).toHaveText('Saves: 0');
    await page.getByTestId('saved-series-time').click();
    await expect(page.getByTestId('saved-schedule')).toHaveText('Saved: 14:30');
    await expect(page.getByTestId('schedule-save-count')).toHaveText('Saves: 1');
});

test('the schedule picker applies its value from the explicit picker action', async ({ page }) => {
    await page.goto('/browser-tests/task-schedule.html');

    await page.getByRole('button', { name: /choose time/i }).click();
    await page.getByRole('button', { name: 'Accept' }).click();

    await expect(page.getByTestId('schedule-save-count')).toHaveText('Saves: 1');
});

test('the series apply action appears in the time change popover', async ({ page }) => {
    await page.goto('/browser-tests/task-schedule.html');

    await expect(page.getByRole('button', { name: 'Apply to series' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Change series time' }).click();

    const dialog = page.getByRole('dialog', { name: 'Change series time' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Apply to series' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
});
