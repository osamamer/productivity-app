const { Menu, Tray, nativeImage } = require('electron');

const TRAY_ICON_SIZE = 22;

/**
 * The tray icon that keeps Claritard reachable while its window is hidden, so reminders keep
 * arriving in the background.
 *
 * Limitation: some desktops (stock GNOME without an AppIndicator extension) show no tray. The
 * app still runs there; launching it again brings the hidden window back.
 */
function createTray({ icon, mode, onOpen, onChangeStorageMode, onQuit }) {
    const image = nativeImage.createFromPath(icon).resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE });
    const tray = new Tray(image);
    tray.setToolTip(mode === 'local' ? 'Claritard — on this computer' : 'Claritard — cloud');
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Open Claritard', click: onOpen },
        { label: 'Change storage mode…', click: onChangeStorageMode },
        { type: 'separator' },
        { label: 'Quit Claritard', click: onQuit },
    ]));
    tray.on('click', onOpen);
    return tray;
}

module.exports = { createTray };
