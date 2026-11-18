const fs = require('node:fs/promises');
const path = require('node:path');

/*
 * electron-updater downloads every .deb update in full. This updater downloads only the blocks
 * that changed since the installed version, the way electron-updater already does for the
 * AppImage:
 *
 *   - Each release publishes <deb>.blockmap: the checksum and size of every block of the .deb,
 *     with block edges chosen by the content (scripts/debDifferential.js), so inserting bytes
 *     only changes the blocks around the insert.
 *   - The installed version's .deb is kept as INSTALLED_DEB in the updater's cache directory,
 *     with its blockmap beside it (debInstall.js moves them there after a successful install).
 *   - To update, the new blockmap is compared with the old one. Blocks present in both are copied
 *     from the old .deb; only the rest is fetched with HTTP range requests. The result is checked
 *     against the release's sha512, and any failure falls back to a full download.
 *
 * The first update after switching to this still downloads in full, since there is no old .deb
 * to copy from yet. Keeping the old .deb costs about its size (~270 MB) in ~/.cache.
 */
const INSTALLED_DEB = 'installer.deb';
const INSTALLED_BLOCKMAP = 'installer.deb.blockmap';
// The name electron-updater's differential download reads the old blockmap from.
const UPDATER_BLOCKMAP = 'current.blockmap';

function createDebUpdater() {
    const { DebUpdater } = require('electron-updater');
    const { findFile } = require('electron-updater/out/providers/Provider');
    const { DOWNLOAD_PROGRESS } = require('electron-updater/out/types');

    class DifferentialDebUpdater extends DebUpdater {
        async doDownloadUpdate(downloadUpdateOptions) {
            const { provider, info } = downloadUpdateOptions.updateInfoAndProvider;
            const fileInfo = findFile(provider.resolveFiles(info), 'deb', ['AppImage', 'rpm', 'pacman']);
            const { cacheDir } = await this.getOrCreateDownloadHelper();
            await prepareInstalledDeb(cacheDir, this.app.version);
            return this.executeDownload({
                fileExtension: 'deb',
                fileInfo,
                downloadUpdateOptions,
                task: async (updateFile, downloadOptions) => {
                    if (this.listenerCount(DOWNLOAD_PROGRESS) > 0) {
                        downloadOptions.onProgress = progress => this.emit(DOWNLOAD_PROGRESS, progress);
                    }
                    const canDiff = await exists(path.join(cacheDir, INSTALLED_DEB));
                    const needsFull = !canDiff
                        || await this.differentialDownloadInstaller(fileInfo, downloadUpdateOptions, updateFile, provider, INSTALLED_DEB);
                    if (!needsFull) return;
                    await this.httpExecutor.download(fileInfo.url, updateFile, downloadOptions);
                    await this.saveNewBlockMap(fileInfo, downloadUpdateOptions, path.dirname(updateFile));
                },
            });
        }

        /** Keeps the downloaded .deb's blockmap so the next update can diff against it. */
        async saveNewBlockMap(fileInfo, downloadUpdateOptions, pendingDir) {
            try {
                const data = await this.httpExecutor.downloadToBuffer(new URL(`${fileInfo.url.href}.blockmap`), {
                    headers: downloadUpdateOptions.requestHeaders,
                    cancellationToken: downloadUpdateOptions.cancellationToken,
                });
                await fs.writeFile(path.join(pendingDir, UPDATER_BLOCKMAP), data);
            } catch (error) {
                this._logger.warn(`No blockmap for the new .deb, the next update downloads in full: ${error.message}`);
            }
        }
    }
    return new DifferentialDebUpdater();
}

/**
 * Makes the cache hold the installed .deb and the blockmap that describes it, under the names
 * electron-updater's differential download reads. A blockmap that does not describe the
 * installed .deb would only produce a wrong copy plan, so without one the updater fetches the
 * old release's blockmap instead.
 */
async function prepareInstalledDeb(cacheDir, installedVersion) {
    const installedDeb = path.join(cacheDir, INSTALLED_DEB);
    if (!await exists(installedDeb)) await adoptInstalledDeb(cacheDir, installedVersion);
    const updaterBlockMap = path.join(cacheDir, UPDATER_BLOCKMAP);
    try {
        await fs.copyFile(path.join(cacheDir, INSTALLED_BLOCKMAP), updaterBlockMap);
    } catch {
        await fs.rm(updaterBlockMap, { force: true });
    }
}

/**
 * Updates installed before this updater left their .deb in pending/; reuse it when it is the
 * version that is installed now.
 */
async function adoptInstalledDeb(cacheDir, installedVersion) {
    const pendingDir = path.join(cacheDir, 'pending');
    let names;
    try {
        names = await fs.readdir(pendingDir);
    } catch {
        return;
    }
    const name = names.find(file => file.endsWith('.deb') && !file.startsWith('temp-') && file.includes(`_${installedVersion}_`));
    if (name) await fs.rename(path.join(pendingDir, name), path.join(cacheDir, INSTALLED_DEB));
}

async function exists(file) {
    try {
        await fs.access(file);
        return true;
    } catch {
        return false;
    }
}

module.exports = { createDebUpdater, prepareInstalledDeb, INSTALLED_DEB, INSTALLED_BLOCKMAP };
