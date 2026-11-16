const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appMenu', {
    select: id => ipcRenderer.send('menu:select', id),
    close: () => ipcRenderer.send('menu:close'),
    reportSize: size => ipcRenderer.send('menu:size', size),
    onItems: callback => ipcRenderer.on('menu:items', (_event, items) => callback(items)),
    onOpened: callback => ipcRenderer.on('menu:opened', () => callback()),
    onTheme: callback => ipcRenderer.on('menu:theme', (_event, theme) => callback(theme)),
});
