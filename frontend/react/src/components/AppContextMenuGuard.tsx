import { useEffect } from 'react';

export const CONTEXT_MENU_SPACE_ATTRIBUTE = 'data-context-menu-space';

function isOpenSpaceTarget(target: EventTarget | null): boolean {
    if (target === document.body || target === document.documentElement) return true;

    const appRoot = document.getElementById('root');
    if (target === appRoot) return true;

    return target instanceof Element && target.hasAttribute(CONTEXT_MENU_SPACE_ATTRIBUTE);
}

/**
 * Keep the browser context menu off app UI while leaving marked background surfaces available.
 * Context-menu handlers inside the app still receive the event because preventDefault does not
 * stop propagation; they can replace the browser menu with their own menu as usual.
 */
export function useAppContextMenuGuard(): void {
    useEffect(() => {
        const preventBrowserContextMenu = (event: MouseEvent) => {
            if (!isOpenSpaceTarget(event.target)) event.preventDefault();
        };

        document.addEventListener('contextmenu', preventBrowserContextMenu, true);
        return () => document.removeEventListener('contextmenu', preventBrowserContextMenu, true);
    }, []);
}
