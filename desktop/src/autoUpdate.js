const { isDebInstall, scheduleDebInstall } = require('./debInstall');

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

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
    if (!app.isPackaged || !enabled) return;
    let autoUpdater;
    try {
        ({ autoUpdater } = require('electron-updater'));
    } catch (error) {
        console.warn(`Auto-update unavailable: ${error.message}`);
        return;
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

    let prompted = false;
    autoUpdater.on('update-downloaded', async info => {
        if (deb) pendingDeb = info.downloadedFile;
        // The app usually lives in the tray and rarely quits, so ask instead of waiting for a quit.
        if (prompted) return;
        prompted = true;
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
    });
    autoUpdater.on('error', error => console.warn(`Auto-update failed: ${error.message}`, error));

    const check = () => autoUpdater.checkForUpdates().catch(error => console.warn(`Update check failed: ${error.message}`, error));
    check();
    setInterval(check, CHECK_INTERVAL_MS).unref();
}

module.exports = { startAutoUpdates };
