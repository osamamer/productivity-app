const { isDebInstall, scheduleDebInstall } = require('./debInstall');
const { createDebUpdater } = require('./debUpdater');

// Releases go out on every push to master and a failed download is only retried on the next
// check (electron-updater does not resume it), so check often; a check is one small YAML fetch.
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const PROGRESS_SEND_MS = 500;

/**
 * Keeps installed copies current from this repo's GitHub releases (published by
 * .github/workflows/release-desktop.yml). Works for both the AppImage and the .deb, and both
 * download only what changed since the installed version (the .deb through debUpdater.js).
 * Only the updater's own request leaves the machine; it runs in the main process on
 * electron-updater's private session, so the local-mode window guard is unaffected.
 * Set "autoUpdate": false in the desktop config file to turn it off.
 *
 * The .deb is installed by a detached helper after the app has exited (see debInstall.js),
 * not by electron-updater's own in-process install.
 *
 * onDownload receives what to show while an update downloads (see describeDownload), or null
 * when there is nothing to show. Progress is shown only once someone asked for a check, so the
 * hourly background downloads stay out of sight.
 */
function startAutoUpdates({ app, dialog, enabled = true, onDownload = () => {} }) {
    const unavailable = reason => ({ checkNow: () => dialog.showMessageBox({ type: 'info', title: 'Updates', message: reason }) });
    if (!app.isPackaged) return unavailable('Updates are only available in the installed app.');
    if (!enabled) return unavailable('Automatic updates are turned off ("autoUpdate": false in the desktop config file).');
    const deb = isDebInstall(process.resourcesPath);
    let autoUpdater;
    try {
        autoUpdater = deb ? createDebUpdater() : require('electron-updater').autoUpdater;
    } catch (error) {
        console.warn(`Auto-update unavailable: ${error.message}`);
        return unavailable(`Updates are unavailable: ${error.message}`);
    }

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = !deb;

    let pendingDeb = null;
    let relaunchAfterInstall = false;
    if (deb) {
        app.on('will-quit', () => {
            if (!pendingDeb) return;
            scheduleDebInstall({
                appPid: process.pid,
                debPath: pendingDeb,
                relaunchPath: relaunchAfterInstall ? process.execPath : '',
            });
            pendingDeb = null;
        });
    }

    let promptedVersion = null;
    let downloaded = null;
    let downloading = null;
    let showProgress = false;
    let lastSent = 0;
    const sendProgress = () => {
        if (!showProgress) return;
        lastSent = Date.now();
        onDownload(downloading && describeDownload(downloading));
    };
    const stopProgress = () => {
        downloading = null;
        showProgress = false;
        onDownload(null);
    };
    autoUpdater.on('update-available', info => {
        // Every check announces the update again, even while it is still downloading.
        if (downloading?.version === info.version) return;
        downloading = { version: info.version, percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 };
        sendProgress();
    });
    autoUpdater.on('download-progress', progress => {
        downloading = { version: downloading?.version, ...progress };
        if (Date.now() - lastSent >= PROGRESS_SEND_MS) sendProgress();
    });
    const promptRestart = async info => {
        const { response } = await dialog.showMessageBox({
            type: 'info',
            title: 'Claritard update ready',
            message: `Claritard ${info.version} has been downloaded.`,
            detail: 'Restart now to finish updating, or it will install the next time Claritard quits.',
            buttons: ['Restart now', 'Later'],
            defaultId: 0,
            cancelId: 1,
        });
        if (response !== 0) return;
        if (deb) {
            relaunchAfterInstall = true;
            app.quit();
        } else {
            autoUpdater.quitAndInstall();
        }
    };
    autoUpdater.on('update-downloaded', info => {
        stopProgress();
        downloaded = info;
        if (deb) pendingDeb = info.downloadedFile;
        // The app usually lives in the tray and rarely quits, so ask instead of waiting for a quit.
        // Ask again for each newer build, since "Later" on an older one should not hide it.
        if (promptedVersion === info.version) return;
        promptedVersion = info.version;
        void promptRestart(info);
    });
    autoUpdater.on('error', error => {
        console.warn(`Auto-update failed: ${error.message}`, error);
        const wasShowing = showProgress && downloading;
        stopProgress();
        if (wasShowing) void dialog.showMessageBox({ type: 'warning', title: 'Updates', message: 'The update download failed.', detail: error.message });
    });

    const check = () => autoUpdater.checkForUpdates().catch(error => console.warn(`Update check failed: ${error.message}`, error));
    check();
    setInterval(check, CHECK_INTERVAL_MS).unref();

    const checkNow = async () => {
        let outcome;
        try {
            const result = await autoUpdater.checkForUpdates();
            if (result?.isUpdateAvailable && downloaded?.version === result.updateInfo.version) return promptRestart(downloaded);
            if (result?.isUpdateAvailable) {
                showProgress = true;
                sendProgress();
            }
            outcome = describeCheck({ result, currentVersion: app.getVersion() });
        } catch (error) {
            console.warn(`Update check failed: ${error.message}`, error);
            outcome = describeCheck({ error, currentVersion: app.getVersion() });
        }
        await dialog.showMessageBox({ type: outcome.type, title: 'Updates', message: outcome.message, detail: outcome.detail });
    };
    return { checkNow };
}

/** What to tell someone who asked for an update check, from electron-updater's result. */
function describeCheck({ result, error, currentVersion }) {
    if (error) return { type: 'warning', message: 'Could not check for updates.', detail: error.message };
    if (!result?.isUpdateAvailable) {
        return { type: 'info', message: 'Claritard is up to date.', detail: `You have version ${currentVersion}.` };
    }
    return {
        type: 'info',
        message: `Claritard ${result.updateInfo.version} is available.`,
        detail: 'It is downloading now; progress shows in the title bar, and you will be asked to restart when it is ready.',
    };
}

/** The title-bar text for a download in progress, from electron-updater's progress event. */
function describeDownload({ version, percent = 0, transferred = 0, total = 0, bytesPerSecond = 0 }) {
    const fraction = Math.min(1, Math.max(0, percent / 100));
    const speed = bytesPerSecond > 0 ? ` · ${formatBytes(bytesPerSecond)}/s` : '';
    const label = `Update ${Math.floor(fraction * 100)}%${speed}`;
    const name = version ? `Claritard ${version}` : 'the update';
    if (!total) return { fraction, label, detail: `Starting to download ${name}…` };
    const remaining = bytesPerSecond > 0 ? `, ${formatDuration((total - transferred) / bytesPerSecond)} left` : '';
    return { fraction, label, detail: `Downloading ${name}: ${formatBytes(transferred)} of ${formatBytes(total)}${remaining}` };
}

function formatBytes(bytes) {
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(bytes >= 1e8 ? 0 : 1)} MB`;
    if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
    return `${Math.round(bytes)} B`;
}

function formatDuration(seconds) {
    if (seconds < 60) return 'under a minute';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `about ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `about ${hours} h${rest ? ` ${rest} min` : ''}`;
}

module.exports = { startAutoUpdates, describeCheck, describeDownload };
