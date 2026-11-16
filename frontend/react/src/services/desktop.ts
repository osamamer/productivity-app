// The Linux desktop shell exposes this bridge from its preload script. It is absent in browsers.
export type DesktopStorageMode = 'local' | 'cloud';

export interface DesktopNotification {
    title: string;
    body?: string;
    tag?: string;
    // An in-app path to open when the notification is clicked.
    targetUrl?: string;
}

export interface AppPauseSettings {
    delaySeconds: number;
    // 0 leaves the app open.
    closeAfterSeconds: number;
    // Open as soon as the countdown ends, instead of waiting for an Open click.
    autoOpen: boolean;
    message: string;
}

export interface TimedApp {
    // The desktop ID that represents every launcher alias of the app.
    id: string;
    name: string;
    icon: string | null;
    aliases: string[];
    settings: AppPauseSettings | null;
}

export interface SiteTimer {
    url: string;
    delaySeconds: number;
    // Firefox closes this long after the first timed site is opened.
    closeAfterSeconds: number;
    message: string;
}

export interface TimeoutState {
    apps: TimedApp[];
    urls: SiteTimer[];
    browser: {
        hostInstalled: boolean;
        extensionDir: string;
        // Epoch ms Firefox closes at, while a timed session runs.
        sessionDeadline: number | null;
        unlockedUrls: string[];
    };
}

export interface TimeoutAppearance {
    mode: 'light' | 'dark';
    background: string;
    paper: string;
    text: string;
    textSecondary: string;
    primary: string;
    onPrimary: string;
}

// App launch delays, auto-close and Firefox site timers on this computer. Calls reject with a
// message that can be shown to the user.
export interface DesktopTimeouts {
    getState: () => Promise<TimeoutState>;
    // Null when the app can be changed now; otherwise why not (e.g. it is running).
    lockReason: (appId: string) => Promise<string | null>;
    saveApp: (appId: string, settings: AppPauseSettings) => Promise<void>;
    removeApp: (appId: string) => Promise<void>;
    // Returns the normalized URL the timer was saved under.
    saveUrl: (previousUrl: string | null, url: string, settings: Omit<SiteTimer, 'url'>) => Promise<string>;
    removeUrl: (url: string) => Promise<void>;
    installBrowserHost: () => Promise<void>;
    openExtensionFolder: () => Promise<void>;
    setAppearance: (appearance: TimeoutAppearance) => Promise<void>;
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
    // Absent in desktop builds that predate app timeouts.
    timeouts?: DesktopTimeouts;
}

// Guarded so modules importing this still load in Node-based regression tests.
export const desktopBridge: DesktopBridge | undefined =
    typeof window === 'undefined' ? undefined : window.claritardDesktop;

export const isDesktopApp = desktopBridge !== undefined;

export const localDesktopToken: string | null =
    desktopBridge?.mode === 'local' && desktopBridge.localToken ? desktopBridge.localToken : null;

export const isLocalDesktopMode = localDesktopToken !== null;

export const desktopTimeouts: DesktopTimeouts | undefined = desktopBridge?.timeouts;
