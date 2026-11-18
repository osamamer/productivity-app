const { isDebInstall, scheduleDebInstall } = require('./debInstall');

// Releases go out on every push to master and a failed download is only retried on the next
// check (electron-updater does not resume it), so check often; a check is one small YAML fetch.
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Keeps installed copies current from this repo's GitHub releases (published by
 * .github/workflows/release-desktop.yml). Works for both the AppImage and the .deb.
 * Only the updater's own request leaves the machine; it runs in the main process on
 * electron-updater's private session, so the local-mode window guard is unaffected.
 * Set "autoUpdate": false in the desktop config file to turn it off.
 *
 * The .deb is installed by a detached helper after the app has exited (see debInstall.js),
 * not by electron-updater's own in-process install.
 */
function startAutoUpdates({ app, dialog, enabled = true }) {
    const unavailable = reason => ({ checkNow: () => dialog.showMessageBox({ type: 'info', title: 'Updates', message: reason }) });
    if (!app.isPackaged) return unavailable('Updates are only available in the installed app.');
    if (!enabled) return unavailable('Automatic updates are turned off ("autoUpdate": false in the desktop config file).');
    let autoUpdater;
    try {
        ({ autoUpdater } = require('electron-updater'));
    } catch (error) {
        console.warn(`Auto-update unavailable: ${error.message}`);
        return unavailable(`Updates are unavailable: ${error.message}`);
    }

    const deb = isDebInstall(process.resourcesPath);
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
        downloaded = info;
        if (deb) pendingDeb = info.downloadedFile;
        // The app usually lives in the tray and rarely quits, so ask instead of waiting for a quit.
        // Ask again for each newer build, since "Later" on an older one should not hide it.
        if (promptedVersion === info.version) return;
        promptedVersion = info.version;
        void promptRestart(info);
    });
    autoUpdater.on('error', error => console.warn(`Auto-update failed: ${error.message}`, error));

    const check = () => autoUpdater.checkForUpdates().catch(error => console.warn(`Update check failed: ${error.message}`, error));
    check();
    setInterval(check, CHECK_INTERVAL_MS).unref();

    const checkNow = async () => {
        let outcome;
        try {
            const result = await autoUpdater.checkForUpdates();
            if (result?.isUpdateAvailable && downloaded?.version === result.updateInfo.version) return promptRestart(downloaded);
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
        detail: 'It is downloading in the background; you will be asked to restart when it is ready.',
    };
}

module.exports = { startAutoUpdates, describeCheck };
