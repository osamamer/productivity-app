const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appHeader', {
    minimize: () => ipcRenderer.send('header:minimize'),
    toggleMaximize: () => ipcRenderer.send('header:toggle-maximize'),
    close: () => ipcRenderer.send('header:close'),
    changeMode: () => ipcRenderer.send('header:change-mode'),
    toggleMenu: anchor => ipcRenderer.send('header:toggle-menu', anchor),
    onWindowState: callback => ipcRenderer.on('header:window-state', (_event, state) => callback(state)),
    onUpdateDownload: callback => ipcRenderer.on('header:update-download', (_event, download) => callback(download)),
    onTheme: callback => ipcRenderer.on('header:theme', (_event, theme) => callback(theme)),
});
