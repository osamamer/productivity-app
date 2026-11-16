const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appHeader', {
    minimize: () => ipcRenderer.send('header:minimize'),
    toggleMaximize: () => ipcRenderer.send('header:toggle-maximize'),
    close: () => ipcRenderer.send('header:close'),
    toggleMenu: anchor => ipcRenderer.send('header:toggle-menu', anchor),
    onWindowState: callback => ipcRenderer.on('header:window-state', (_event, state) => callback(state)),
    onTheme: callback => ipcRenderer.on('header:theme', (_event, theme) => callback(theme)),
});
