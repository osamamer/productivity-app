const { contextBridge, ipcRenderer } = require('electron');

// Shared by the countdown window and the "closes in" popups; both are local pages Claritard owns.
contextBridge.exposeInMainWorld('timeoutWindow', {
    onState: callback => ipcRenderer.on('timeout:state', (_event, state) => callback(state)),
    open: () => ipcRenderer.send('timeout:open'),
    cancel: () => ipcRenderer.send('timeout:cancel'),
});
