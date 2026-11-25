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
    // Seconds a day the app may run; once used up it is closed and cannot be opened until tomorrow. 0 = no limit.
    dailyLimitSeconds: number;
    // Open as soon as the countdown ends, instead of waiting for an Open click.
    autoOpen: boolean;
    message: string;
    // False: auto-close and the daily limit pause while every window of the app is minimized.
    // Absent in desktop builds that predate it, which always count.
    countMinimized?: boolean;
    // What happens when time is up; absent in older builds, which always close.
    onTimeUp?: AppTimeUpAction;
}

export type AppTimeUpAction = 'close' | 'minimize';

// How the time left before an app closes is shown.
export type CountdownDisplay = 'window' | 'notification';

export interface TimedApp {
    // The desktop ID that represents every launcher alias of the app.
    id: string;
    name: string;
    icon: string | null;
    aliases: string[];
    settings: AppPauseSettings | null;
    // Seconds the app has run today, counted only while it has a daily limit.
    usedTodaySeconds?: number;
}

export interface SiteTimer {
    url: string;
    delaySeconds: number;
    // Firefox closes this long after the first timed site is opened.
    closeAfterSeconds: number;
    // Seconds a day the site may be open; once used up it cannot be opened until tomorrow. 0 = no limit.
    dailyLimitSeconds: number;
    message: string;
    usedTodaySeconds?: number;
}

// Boundaries change only after the password and a short wait. Times are epoch ms; 0 while locked.
export interface BoundaryEditStatus {
    hasPassword: boolean;
    readyAt: number;
    unlockedUntil: number;
    waitMs: number;
}

export interface TimeoutState {
    apps: TimedApp[];
    urls: SiteTimer[];
    // Absent in desktop builds that predate the Boundaries password.
    editLock?: BoundaryEditStatus;
    // Absent in desktop builds that predate the choice, which always show a window.
    countdownDisplay?: CountdownDisplay;
    // Whether minimized windows can be seen and apps minimized (KDE Plasma only).
    windowControl?: boolean;
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
    saveUrl: (previousUrl: string | null, url: string, settings: Omit<SiteTimer, 'url' | 'usedTodaySeconds'>) => Promise<string>;
    removeUrl: (url: string) => Promise<void>;
    // Absent in desktop builds that predate the Boundaries password. unlockEditing rejects a wrong password.
    editStatus?: () => Promise<BoundaryEditStatus>;
    setEditPassword?: (password: string) => Promise<BoundaryEditStatus>;
    unlockEditing?: (password: string) => Promise<BoundaryEditStatus>;
    lockEditing?: () => Promise<BoundaryEditStatus>;
    installBrowserHost: () => Promise<void>;
    openExtensionFolder: () => Promise<void>;
    setAppearance: (appearance: TimeoutAppearance) => Promise<void>;
    // Absent in desktop builds that predate the choice. Needs no password.
    setCountdownDisplay?: (display: CountdownDisplay) => Promise<void>;
}

export interface UsageSegment {
    // Epoch ms; active use of one app.
    start: number;
    end: number;
    appId: string;
    title: string | null;
}

export interface UsageInterval {
    start: number;
    end: number;
}

export interface UsageApp {
    id: string;
    name: string;
    // A data URL, or null when the launcher has no usable icon.
    icon: string | null;
}

export interface UsageRange {
    segments: UsageSegment[];
    apps: Record<string, UsageApp>;
    // When the tracker was running. Inside it with no segment = idle, locked or away;
    // outside it = not tracked.
    tracked: UsageInterval[];
}

export interface ClassifiedScreenSpan extends UsageInterval {
    activityId: string;
}

export interface UsageSettings {
    activityByApp?: Record<string, string>;
    enabled: boolean;
    recordTitles: boolean;
    startAtLogin: boolean;
}

export interface UsageStatus {
    settings: UsageSettings;
    supported: boolean;
    // Why tracking cannot run on this desktop, when it cannot.
    reason: string | null;
    tracking: boolean;
}

export interface UsageDailyTotal {
    // Local date, `YYYY-MM-DD`. Dates with no app time are absent.
    date: string;
    totalMs: number;
    apps: Record<string, number>;
}

export interface UsageDailyTotals {
    days: UsageDailyTotal[];
    apps: Record<string, UsageApp>;
}

// Desktop screen time, recorded and kept on this computer only. Calls reject with a message
// that can be shown to the user.
export interface DesktopUsage {
    getStatus: () => Promise<UsageStatus>;
    getRange: (fromMs: number, toMs: number) => Promise<UsageRange>;
    // Absent in desktop builds that predate the screen-time report. Covers up to about a year.
    getDailyTotals?: (fromMs: number, toMs: number) => Promise<UsageDailyTotals>;
    assignActivity?: (appId: string, activityId: string | null) => Promise<UsageStatus>;
    getActivityTime?: (fromMs: number, toMs: number) => Promise<ClassifiedScreenSpan[]>;
    saveSettings: (settings: UsageSettings) => Promise<UsageStatus>;
}

export interface DesktopBridge {
    mode: DesktopStorageMode;
    // A token for the single local user, signed with a secret the shell regenerates every launch.
    localToken?: string;
    cloudUrl?: string;
    // Absent in desktop builds that predate showing the version in settings.
    version?: string;
    openModeChooser: () => void;
    // Electron cannot list service-worker notifications, so the shell shows them natively.
    // Resolves false when the desktop has no notification service.
    showNotification: (notification: DesktopNotification) => Promise<boolean>;
    // Returns a function that removes the listener.
    onNotificationClick: (callback: (targetUrl: string) => void) => () => void;
    // Absent in desktop builds that predate app timeouts.
    timeouts?: DesktopTimeouts;
    // Absent in desktop builds that predate screen time.
    usage?: DesktopUsage;
}

// Guarded so modules importing this still load in Node-based regression tests.
export const desktopBridge: DesktopBridge | undefined =
    typeof window === 'undefined' ? undefined : window.claritardDesktop;

export const isDesktopApp = desktopBridge !== undefined;

export const localDesktopToken: string | null =
    desktopBridge?.mode === 'local' && desktopBridge.localToken ? desktopBridge.localToken : null;

export const isLocalDesktopMode = localDesktopToken !== null;

export const desktopTimeouts: DesktopTimeouts | undefined = desktopBridge?.timeouts;

export const desktopUsage: DesktopUsage | undefined = desktopBridge?.usage;
