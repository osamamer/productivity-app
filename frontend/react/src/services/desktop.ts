// The Linux desktop shell exposes this bridge from its preload script. It is absent in browsers.
export type DesktopStorageMode = 'local' | 'cloud';

export interface DesktopNotification {
    title: string;
    body?: string;
    tag?: string;
    // An in-app path to open when the notification is clicked.
    targetUrl?: string;
}

export interface DesktopBridge {
    mode: DesktopStorageMode;
    // A token for the single local user, signed with a secret the shell regenerates every launch.
    localToken?: string;
    cloudUrl?: string;
    openModeChooser: () => void;
    // Electron cannot list service-worker notifications, so the shell shows them natively.
    // Resolves false when the desktop has no notification service.
    showNotification: (notification: DesktopNotification) => Promise<boolean>;
    // Returns a function that removes the listener.
    onNotificationClick: (callback: (targetUrl: string) => void) => () => void;
}

// Guarded so modules importing this still load in Node-based regression tests.
export const desktopBridge: DesktopBridge | undefined =
    typeof window === 'undefined' ? undefined : window.claritardDesktop;

export const isDesktopApp = desktopBridge !== undefined;

export const localDesktopToken: string | null =
    desktopBridge?.mode === 'local' && desktopBridge.localToken ? desktopBridge.localToken : null;

export const isLocalDesktopMode = localDesktopToken !== null;
