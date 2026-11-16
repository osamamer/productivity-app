const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('storageChooser', {
    getState: () => ipcRenderer.invoke('chooser:get-state'),
    choose: choice => ipcRenderer.invoke('chooser:choose', choice),
});
