const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Keeps installed copies current from this repo's GitHub releases (published by
 * .github/workflows/release-desktop.yml). Works for both the AppImage and the .deb.
 * Only the updater's own request leaves the machine; it runs in the main process on
 * electron-updater's private session, so the local-mode window guard is unaffected.
 * Set "autoUpdate": false in the desktop config file to turn it off.
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

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    let prompted = false;
    autoUpdater.on('update-downloaded', async info => {
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
        if (response === 0) autoUpdater.quitAndInstall();
    });
    autoUpdater.on('error', error => console.warn(`Auto-update failed: ${error.message}`));

    const check = () => autoUpdater.checkForUpdates().catch(error => console.warn(`Update check failed: ${error.message}`));
    check();
    setInterval(check, CHECK_INTERVAL_MS).unref();
}

module.exports = { startAutoUpdates };
