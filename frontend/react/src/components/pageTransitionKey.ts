/**
 * Which page a path belongs to, for the entrance animation. Moving within a page (a tab, the
 * next day) keeps the same key, so the page stays mounted and only its content changes.
 */
export function pageTransitionKey(pathname: string): string {
    const [section] = pathname.split('/').filter(Boolean);
    return `/${section ?? ''}`;
}
