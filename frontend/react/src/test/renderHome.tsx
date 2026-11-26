import { renderPage, type PageFixture } from './renderPage';

/** Renders the real Home page against the fake task API. */
export function renderHome(fixture: PageFixture = {}) {
    return renderPage(async () => {
        const { HomePage } = await import('../pages/HomePage');
        return <HomePage />;
    }, { path: '/home', ...fixture });
}
