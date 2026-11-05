const { contextBridge, ipcRenderer } = require('electron');

// The overlay page is plain HTML, so it only gets these narrow calls.
contextBridge.exposeInMainWorld('bubble', {
  dragStart: () => ipcRenderer.send('bubble:drag-start'),
  dragMove: (dx, dy) => ipcRenderer.send('bubble:drag-move', { dx, dy }),
  expand: () => ipcRenderer.send('bubble:expand'),
  collapse: () => ipcRenderer.send('bubble:collapse'),
  openPath: (routePath) => ipcRenderer.send('bubble:open-path', routePath),
  togglePin: () => ipcRenderer.send('bubble:toggle-pin'),
  dock: () => ipcRenderer.send('bubble:dock'),
  quit: () => ipcRenderer.send('bubble:quit'),
  onExpanded: (cb) => ipcRenderer.on('bubble:expanded', (_event, flag) => cb(Boolean(flag))),
  onPinState: (cb) => ipcRenderer.on('bubble:pin-state', (_event, state) => cb(Boolean(state))),
});
