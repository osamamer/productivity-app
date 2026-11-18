const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, session, shell } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readConfig, writeConfig } = require('./config');
const { createAppWindow } = require('./appWindow');
const { menuItems, createCommands, installShortcuts } = require('./appMenu');
const { PopupMenu } = require('./popupMenu');
const { DesktopNotifications } = require('./desktopNotifications');
const { sanitizeNotificationRequest } = require('./notificationRequest');
const { createTray } = require('./tray');
const { LocalBackend } = require('./localBackend');
const { createAuthSecret, signLocalToken } = require('./localToken');
const { installLocalNetworkGuard } = require('./networkGuard');
const { parseTimeoutCommand, selfCommand } = require('./timeouts/cli');
const { TimeoutService } = require('./timeouts/service');
const { registerTimeoutIpc } = require('./timeouts/ipc');
const { startAutoUpdates } = require('./autoUpdate');
const { deferLaunchUntilInstalled } = require('./debInstall');
const { UsageService } = require('./usage/service');
const { registerUsageIpc } = require('./usage/ipc');
const { HIDDEN_SWITCH } = require('./usage/core/autostart');
const { BUNDLED_ORIGIN, registerBundledScheme, serveBundledWebApp, hasBundledWebApp } = require('./bundledWebApp');

// Must match the port baked into the local web build by scripts/build-resources.sh.
const LOCAL_PORT = 47830;
const CLOUD_ORIGIN = 'https://claritard.com';

const resourcesDir = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', 'resources');
const userDataDir = app.getPath('userData');
const localDataDir = path.join(userDataDir, 'local-data');
const logDir = path.join(userDataDir, 'logs');
const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
const cloudFrontendDir = path.join(resourcesDir, 'cloud-frontend');

registerBundledScheme(protocol);

/** What the running window is connected to; `null` until a mode is launched. */
let runtime = null;
/** `{ window, header, content, menu, commands }`, or `null` before launch. */
let appWindow = null;
let chooserWindow = null;
let backend = null;
let tray = null;
// Closing the window only hides it; these distinguish a real quit from that.
let quitting = false;
let backendStopped = false;
let trayHintShown = false;
/** App and Firefox time limits; created once the app is ready. */
let timeouts = null;
// False while Claritard runs only to show a timeout countdown (started by a delayed launcher or a
// timer); it then quits once no countdown or timed session needs it.
let uiStarted = false;
let updates = null;
/** Desktop screen time; tracks only while the UI has been started and the user opted in. */
let usage = null;
let usageStopped = false;
// Started at login: stay in the tray until the user opens the window.
const startHidden = process.argv.includes(HIDDEN_SWITCH);

const notifications = new DesktopNotifications({
    icon: iconPath,
    onClick: targetUrl => {
        if (!appWindow) return;
        showMainWindow();
        if (targetUrl) appWindow.content.webContents.send('desktop:notification-click', { targetUrl });
    },
});

function showMainWindow() {
    if (!appWindow) return;
    const { window, content } = appWindow;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
    content.webContents.focus();
}

function hideToTray() {
    appWindow?.window.hide();
    if (trayHintShown) return;
    trayHintShown = true;
    notifications.show({
        title: 'Claritard is still running',
        body: 'Reminders keep arriving in the background. Quit from the tray icon or the ⋮ menu.',
        tag: 'claritard-tray-hint',
        targetUrl: null,
    });
}

// The custom header replaces the menu bar; its ⋮ menu holds every command.
Menu.setApplicationMenu(null);

if (app.isPackaged && deferLaunchUntilInstalled({ argv: process.argv })) {
    app.exit(0);
} else if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', (_event, argv) => {
        const timeoutCommand = parseTimeoutCommand(argv);
        if (timeoutCommand) {
            void timeouts?.handleCommand(timeoutCommand);
            return;
        }
        if (appWindow) {
            showMainWindow();
            return;
        }
        if (!chooserWindow) {
            startUi();
            return;
        }
        if (chooserWindow.isMinimized()) chooserWindow.restore();
        chooserWindow.focus();
    });
    app.whenReady().then(startApp);
}

function startApp() {
    const command = selfCommand({ isPackaged: app.isPackaged, appPath: app.getAppPath() });
    usage = new UsageService({ command });
    registerUsageIpc({ usage, isMainAppPage });
    timeouts = new TimeoutService({
        command,
        extensionDir: app.isPackaged ? path.join(process.resourcesPath, 'firefox-extension') : path.join(__dirname, '..', 'firefox-extension'),
        notify: notification => notifications.show(notification),
        onIdleChange: quitIfOnlyTimeoutsAreIdle,
    });
    registerTimeoutIpc({ timeouts, isMainAppPage });
    timeouts.start();
    const timeoutCommand = parseTimeoutCommand(process.argv);
    if (timeoutCommand) {
        void timeouts.handleCommand(timeoutCommand);
        return;
    }
    startUi();
}

function quitIfOnlyTimeoutsAreIdle() {
    if (!uiStarted && !timeouts.busy) app.quit();
}

// The first instance may have been started by a launcher or the Firefox host (a timeout
// command), so updates start with the UI, which a later second-instance launch also reaches.
function startUi() {
    if (!uiStarted) {
        void usage.start();
        updates = startAutoUpdates({
            app,
            dialog,
            enabled: readConfig(userDataDir).autoUpdate !== false,
            onDownload: showUpdateDownload,
        });
    }
    uiStarted = true;
    const config = readConfig(userDataDir);
    if (!config.mode) {
        openChooser();
        return;
    }
    void launch(config);
}

let updateDownload = null;

function showUpdateDownload(download) {
    updateDownload = download;
    sendUpdateDownload();
}

function sendUpdateDownload() {
    if (!appWindow || appWindow.header.webContents.isDestroyed()) return;
    appWindow.header.webContents.send('header:update-download', updateDownload);
    appWindow.window.setProgressBar(updateDownload ? updateDownload.fraction : -1);
}

async function launch(config) {
    if (config.mode === 'local') await launchLocal();
    else launchCloud();
}

function openMainWindow(mode, contentPreferences) {
    appWindow = createAppWindow({ mode, contentPreferences, show: !startHidden });
    const { window, header, content } = appWindow;
    header.webContents.on('did-finish-load', sendUpdateDownload);
    const commands = createCommands({
        window,
        content,
        actions: {
            changeStorageMode: openChooser,
            openLocalDataFolder: () => void openFolder(localDataDir),
            openLogsFolder: () => void openFolder(logDir),
            aboutStorage: () => void showStorageInfo(mode),
            checkForUpdates: () => void updates?.checkNow(),
            quit: () => app.quit(),
        },
    });
    const menu = new PopupMenu({ window, items: menuItems(mode), closeOnPressIn: [content] });
    Object.assign(appWindow, { menu, commands });
    installShortcuts({ views: [content, header, menu.view], commands });

    content.webContents.setWindowOpenHandler(({ url }) => {
        openExternally(url);
        return { action: 'deny' };
    });
    content.webContents.on('will-navigate', (event, url) => {
        if (!runtime || isSameOrigin(url, runtime.origin)) return;
        event.preventDefault();
        openExternally(url);
    });
    window.on('close', event => {
        if (quitting) return;
        event.preventDefault();
        hideToTray();
    });
    tray ??= createTray({
        icon: iconPath,
        mode,
        onOpen: showMainWindow,
        onChangeStorageMode: () => {
            showMainWindow();
            openChooser();
        },
        onQuit: () => app.quit(),
    });
    window.on('closed', () => {
        menu.destroy();
        if (appWindow?.window === window) appWindow = null;
    });
    return content.webContents;
}

function openExternally(url) {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
}

async function openFolder(folder) {
    try {
        fs.mkdirSync(folder, { recursive: true });
    } catch (error) {
        console.error(`Could not create ${folder}:`, error);
    }
    const failure = await shell.openPath(folder);
    if (failure) {
        console.error(`Could not open ${folder}: ${failure}`);
        void dialog.showMessageBox(appWindow?.window, { type: 'error', message: 'Could not open the folder', detail: `${folder}\n\n${failure}` });
    }
}

function showStorageInfo(mode) {
    return dialog.showMessageBox(appWindow?.window, {
        type: 'info',
        title: 'Data storage',
        message: mode === 'local' ? 'Stored on this computer' : 'Stored in the cloud',
        detail: mode === 'local'
            ? `Your data is stored only on this computer in:\n${localDataDir}\n\nThe app makes no connections to the cloud.`
            : `Your data is stored on ${CLOUD_ORIGIN}.`,
    });
}

async function launchLocal() {
    const origin = `http://127.0.0.1:${LOCAL_PORT}`;
    installLocalNetworkGuard(session.defaultSession, origin);
    // Spell-check dictionaries are downloaded from the internet, so local mode turns them off.
    const content = openMainWindow('local', { spellcheck: false });
    await content.loadFile(path.join(__dirname, 'ui', 'starting.html'));

    const secret = createAuthSecret();
    backend = new LocalBackend({ resourcesDir, dataDir: localDataDir, logDir, port: LOCAL_PORT });
    try {
        await backend.start(secret);
    } catch (error) {
        console.error('The local backend could not start:', error);
        await backend.stop();
        showStartupError(error.message, backend.logFile);
        return;
    }
    runtime = {
        mode: 'local',
        origin,
        localToken: signLocalToken(secret, { displayName: os.userInfo().username }),
    };
    if (appWindow) await appWindow.content.webContents.loadURL(`${origin}/`);
}

function showStartupError(message, logFile) {
    if (!appWindow) return;
    void appWindow.content.webContents.loadFile(path.join(__dirname, 'ui', 'error.html'), {
        query: { message, log: fs.existsSync(logFile) ? logFile : path.dirname(logFile) },
    });
}

function launchCloud() {
    // Builds without the bundled web app (running from source before build:resources) fall back
    // to the website.
    const bundled = hasBundledWebApp(cloudFrontendDir);
    if (bundled) serveBundledWebApp(session.defaultSession, net, cloudFrontendDir);
    else console.warn(`No bundled web app in ${cloudFrontendDir}; loading ${CLOUD_ORIGIN} instead`);
    const origin = bundled ? BUNDLED_ORIGIN : CLOUD_ORIGIN;
    runtime = { mode: 'cloud', origin, cloudUrl: CLOUD_ORIGIN };
    const content = openMainWindow('cloud');
    void content.loadURL(`${origin}/`);
}

function openChooser() {
    if (chooserWindow) {
        chooserWindow.focus();
        return;
    }
    chooserWindow = new BrowserWindow({
        width: 640,
        height: 560,
        resizable: false,
        parent: appWindow?.window,
        modal: Boolean(appWindow),
        backgroundColor: '#100e14',
        title: 'Choose where Claritard stores your data',
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'chooserPreload.js'),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            spellcheck: false,
        },
    });
    chooserWindow.on('closed', () => {
        chooserWindow = null;
    });
    void chooserWindow.loadFile(path.join(__dirname, 'ui', 'chooser.html'));
}

function isMainAppPage(sender) {
    if (!runtime || !appWindow || sender !== appWindow.content.webContents) return false;
    return isSameOrigin(sender.getURL(), runtime.origin);
}

// URL.origin is "null" for custom schemes such as claritard://, so compare scheme and host.
function isSameOrigin(url, origin) {
    try {
        const a = new URL(url);
        const b = new URL(origin);
        return a.protocol === b.protocol && a.host === b.host;
    } catch {
        return false;
    }
}

function isHeader(sender) {
    return Boolean(appWindow) && sender === appWindow.header.webContents;
}

ipcMain.on('desktop:get-bridge', event => {
    if (!isMainAppPage(event.sender)) {
        event.returnValue = null;
        return;
    }
    const version = app.getVersion();
    event.returnValue = runtime.mode === 'local'
        ? { mode: 'local', localToken: runtime.localToken, version }
        : { mode: 'cloud', cloudUrl: runtime.cloudUrl, version };
});

ipcMain.on('desktop:open-mode-chooser', () => openChooser());

ipcMain.handle('desktop:show-notification', (event, request) => {
    if (!isMainAppPage(event.sender)) return false;
    const notification = sanitizeNotificationRequest(request);
    return notification ? notifications.show(notification) : false;
});

ipcMain.on('desktop:page-background', (event, background) => {
    if (!appWindow || event.sender !== appWindow.content.webContents || typeof background !== 'string') return;
    appWindow.header.webContents.send('header:theme', { background });
    appWindow.menu.setTheme(background);
});

ipcMain.on('header:minimize', event => {
    if (isHeader(event.sender)) appWindow.window.minimize();
});

ipcMain.on('header:toggle-maximize', event => {
    if (!isHeader(event.sender)) return;
    if (appWindow.window.isMaximized()) appWindow.window.unmaximize();
    else appWindow.window.maximize();
});

ipcMain.on('header:close', event => {
    if (isHeader(event.sender)) appWindow.window.close();
});

ipcMain.on('header:change-mode', event => {
    if (isHeader(event.sender)) openChooser();
});

ipcMain.on('header:toggle-menu', (event, anchor) => {
    if (!isHeader(event.sender)) return;
    appWindow.menu.toggle({ right: Number(anchor?.right) || 0, bottom: Number(anchor?.bottom) || 0 });
});

function isMenu(sender) {
    return Boolean(appWindow) && sender === appWindow.menu.webContents;
}

ipcMain.on('menu:size', (event, size) => {
    if (isMenu(event.sender)) appWindow.menu.setPanelSize({ width: Number(size?.width) || 0, height: Number(size?.height) || 0 });
});

ipcMain.on('menu:close', event => {
    if (isMenu(event.sender)) appWindow.menu.close();
});

ipcMain.on('menu:select', (event, id) => {
    if (!isMenu(event.sender)) return;
    appWindow.menu.close();
    const command = Object.hasOwn(appWindow.commands, id) ? appWindow.commands[id] : null;
    if (command) command();
});

ipcMain.handle('chooser:get-state', () => ({
    currentMode: runtime?.mode ?? null,
    localDataDir,
}));

ipcMain.handle('chooser:choose', (_event, choice) => {
    const mode = choice?.mode === 'cloud' ? 'cloud' : 'local';
    writeConfig(userDataDir, { ...readConfig(userDataDir), mode });

    if (appWindow) {
        // A full restart is the simplest way to stop the local backend and drop the
        // network guard cleanly before connecting somewhere else.
        app.relaunch();
        app.quit();
    } else {
        chooserWindow?.close();
        void launch({ mode });
    }
    return { ok: true };
});

app.on('window-all-closed', () => {
    // A countdown window closing must not end timed sessions that are still running.
    if (timeouts?.busy) return;
    app.quit();
});

app.on('before-quit', event => {
    quitting = true;
    if (usage && !usageStopped) {
        // Writes the open screen-time segment and unloads the KWin script before quitting.
        event.preventDefault();
        usageStopped = true;
        void usage.stopTracking()
            .catch(error => console.error(`Could not stop screen time cleanly: ${error.message}`, error))
            .finally(() => app.quit());
        return;
    }
    if (!backend || backendStopped) return;
    event.preventDefault();
    backendStopped = true;
    void backend.stop().finally(() => app.quit());
});

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => app.quit());
}
