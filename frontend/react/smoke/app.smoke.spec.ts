import { expect, test } from '@playwright/test';

test('sign-in screen renders and registration mode opens and closes', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByLabel('Username or email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();

    await page.getByRole('button', { name: 'Create one' }).click();
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();

    await page.getByRole('button', { name: 'Sign in' }).last().click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(pageErrors).toEqual([]);
});
