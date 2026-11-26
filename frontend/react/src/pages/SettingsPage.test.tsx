import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderPage } from '../test/renderPage';

afterEach(() => vi.useRealTimers());

function renderSettings() {
    return renderPage(async () => {
        const { SettingsPage } = await import('./SettingsPage');
        return <SettingsPage />;
    }, { path: '/settings' });
}

describe('Settings', () => {
    it('renders its sections, including the ones that live in their own files', async () => {
        await renderSettings();

        expect(await screen.findByText('Settings', { selector: 'h4' })).toBeInTheDocument();
        expect(await screen.findByText('Mental state check-ups')).toBeInTheDocument();
        expect(screen.getByText('Browser notifications')).toBeInTheDocument();
    });
});
