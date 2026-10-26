import { expect, test } from '@playwright/test';

for (const embedded of [false, true]) {
    test(`Stat group task editor follows delayed recurrence height inside ${embedded ? 'an embedded frame' : 'the page'}`, async ({ page }) => {
        await page.setViewportSize({ width: 1100, height: embedded ? 850 : 650 });
        await page.clock.install({ time: new Date('2026-10-26T12:00:00') });
        await page.clock.resume();
        let releaseSeries!: () => void;
        const seriesReady = new Promise<void>(resolve => { releaseSeries = resolve; });
        await page.route('**/api/v1/**', async route => {
            if (!route.request().url().includes('task-series')) {
                await route.fulfill({ json: [] });
                return;
            }
            await seriesReady;
            await route.fulfill({ json: {
                seriesId: 'series-1', recurrenceFrequency: 'DAILY', startDateTime: '2026-10-26T19:36:00',
                recurrenceEndDate: null, recurrenceInterval: null, recurrenceUnit: null,
                timeZone: 'Asia/Amman', active: true, repeatSubtasks: false,
            } });
        });
        if (embedded) {
            await page.route('**/calendar-frame', route => route.fulfill({
                contentType: 'text/html',
                body: '<iframe title="Calendar" src="/browser-tests/calendar-popup.html" style="position:absolute;top:70px;left:20px;width:1060px;height:650px;border:0"></iframe>',
            }));
            await page.goto('/calendar-frame');
        } else {
            await page.goto('/browser-tests/calendar-popup.html');
        }
        const frame = embedded ? page.frameLocator('iframe') : page;
        const day = frame.locator('[data-date="2026-10-26"]').first();
        await day.getByText('Stat group', { exact: true }).click();
        const row = frame.getByText('Stat 1', { exact: true });
        const anchor = await row.evaluate(e => {
            const rect = e.closest('[role="button"]')!.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        });
        expect(anchor.y).toBeGreaterThan(400);
        await row.click();
        const editor = frame.getByRole('dialog').filter({ has: frame.getByLabel('Task title') });
        const initialHeight = await editor.evaluate(e => e.getBoundingClientRect().height);
        releaseSeries();
        await expect.poll(() => editor.evaluate(e => e.getBoundingClientRect().height)).toBeGreaterThan(initialHeight + 40);
        await expect.poll(() => editor.evaluate(e => {
            const rect = e.getBoundingClientRect();
            return Math.abs(rect.bottom - (window.innerHeight - 12));
        })).toBeLessThan(1);
        const bounds = await editor.evaluate(e => {
            const rect = e.getBoundingClientRect();
            return { top: rect.top, left: rect.left, height: rect.height, frameHeight: window.innerHeight,
                scrollHeight: e.scrollHeight, clientHeight: e.clientHeight };
        });
        expect(bounds.left).toBeCloseTo(anchor.x, 0);
        expect(bounds.top).toBeLessThan(anchor.y);
        expect(bounds.top).toBeGreaterThan((bounds.frameHeight - bounds.height) / 2 + 50);
        expect(bounds.scrollHeight).toBeLessThanOrEqual(bounds.clientHeight + 1);
        await expect(editor.getByRole('button', { name: 'Save', exact: true })).toBeInViewport();
        await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(editor).toHaveCount(0);
        // A fresh portal must attach observation again after closing the editor.
        await day.getByText('Stat group', { exact: true }).click();
        await frame.getByText('Stat 1', { exact: true }).click();
        await expect.poll(() => editor.evaluate(e => e.getBoundingClientRect().bottom))
            .toBeLessThanOrEqual(638.5);
    });
}

test('opening a busy calendar centers today without moving the page or header', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 650 });
    await page.clock.install({ time: new Date('2026-10-14T12:00:00') });
    await page.clock.resume();
    await page.route('**/api/v1/**', route => route.fulfill({ json: [] }));
    await page.goto('/browser-tests/calendar-popup.html?dense');
    const today = page.locator('.fc-daygrid-day.fc-day-today');
    await expect.poll(() => today.evaluate(e => {
        const scroller = e.closest('.fc-scroller')!;
        const day = e.getBoundingClientRect();
        const viewport = scroller.getBoundingClientRect();
        return Math.abs(day.top + day.height / 2 - viewport.top - scroller.clientHeight / 2);
    })).toBeLessThan(1);
    expect(await today.evaluate(e => e.closest('.fc-scroller')!.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await today.evaluate(e => { e.closest('.fc-scroller')!.scrollTop = 0; });
    await page.getByRole('button', { name: 'Display', exact: true }).click();
    await page.getByLabel('Low').click();
    await expect.poll(() => today.evaluate(e => e.closest('.fc-scroller')!.scrollTop)).toBe(0);
});

test('a tall lower-row day expansion stays below the header during scroll and resize', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 650 });
    await page.clock.install({ time: new Date('2026-10-26T12:00:00') });
    await page.clock.resume();
    await page.route('**/api/v1/**', route => route.fulfill({ json: [] }));
    await page.goto('/browser-tests/calendar-popup.html?dense');
    const day = page.locator('[data-date="2026-10-28"]').first();
    await day.locator('.fc-daygrid-more-link').click();
    const expansion = page.getByRole('dialog', { name: 'Events for October 28, 2026' });
    await expect(expansion).toBeVisible();
    const checkBounds = async () => {
        await expect.poll(() => expansion.evaluate(e => {
            const day = document.querySelector('[data-date="2026-10-28"]')!;
            const scroller = day.closest('.fc-scroller')!;
            const viewport = scroller.getBoundingClientRect();
            const header = document.querySelector('.fc-col-header')!.getBoundingClientRect();
            const rect = e.getBoundingClientRect();
            return rect.top >= header.bottom - 1 && rect.top >= viewport.top - 1
                && rect.bottom <= Math.min(viewport.bottom, innerHeight - 12) + 1;
        })).toBe(true);
    };
    await checkBounds();
    expect(await expansion.evaluate(e => {
        const content = e.lastElementChild!;
        return content.scrollHeight > content.clientHeight;
    })).toBe(true);
    await day.evaluate(e => { e.closest('.fc-scroller')!.scrollTop -= 150; });
    await checkBounds();
    await page.setViewportSize({ width: 1100, height: 450 });
    await checkBounds();
    await expansion.getByRole('button', { name: 'Close day events' }).click();
    await expect(expansion).toHaveCount(0);
});
