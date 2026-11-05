// AUSTWise desktop chat head.
//
// A website can never draw on top of other applications; a native window can.
// Collapsed it is a ~64px transparent always-on-top bubble that sits over every
// app; clicking it grows the same window into the full AUSTWise Quick Hub card,
// without leaving for the browser.
const { app, BrowserWindow, ipcMain, shell, screen, Menu, Tray, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const SITE = 'https://austwise.vercel.app';
const BUBBLE_SIZE = 64;
const CARD = { width: 344, height: 468 };
const MARGIN = 24;

/** @type {BrowserWindow | null} */
let win = null;
/** @type {{ winX: number, winY: number } | null} */
let drag = null;

/** @type {Tray | null} */
let tray = null;

let expanded = false;
let pinned = true;
/** Where the bubble sat before it grew, so collapsing returns it home. */
let bubbleAnchor = null;

/** Keep a window of the given size fully inside the current display's work area. */
function clampToWorkArea(x, y, width, height) {
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const maxX = Math.max(workArea.x, workArea.x + workArea.width - width);
  const maxY = Math.max(workArea.y, workArea.y + workArea.height - height);
  return {
    x: Math.min(Math.max(workArea.x, Math.round(x)), maxX),
    y: Math.min(Math.max(workArea.y, Math.round(y)), maxY),
  };
}

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();

  win = new BrowserWindow({
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    x: workArea.x + workArea.width - BUBBLE_SIZE - MARGIN,
    y: workArea.y + workArea.height - BUBBLE_SIZE - MARGIN,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true, // lives in the tray, not the taskbar
    alwaysOnTop: true,
    title: 'AUSTWise bubble',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 'screen-saver' is the highest level a normal app may use, so the bubble
  // stays above maximised windows and full-screen video.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'overlay.html'));

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('bubble:expanded', expanded);
    win.webContents.send('bubble:pin-state', pinned);
  });

  // Fallback out: right-click anywhere on the bubble.
  win.webContents.on('context-menu', () => {
    Menu.buildFromTemplate([
      { label: 'Open AUSTWise', click: () => shell.openExternal(SITE).catch(() => {}) },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]).popup({ window: win });
  });

  win.on('closed', () => {
    win = null;
  });
}

// ── Tray: the only place the bubble lives outside the screen ──────────────
function showBubble() {
  if (!win) {
    createWindow();
    return;
  }
  win.show();
  win.focus();
}

function createTray() {
  const iconPath = path.join(__dirname, 'tray.png');
  if (!fs.existsSync(iconPath)) {
    console.warn('[austwise] tray.png missing — run: node make-tray-icon.js');
    return;
  }

  tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }));
  tray.setToolTip('AUSTWise bubble');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show bubble', click: () => showBubble() },
      { label: 'Hide bubble', click: () => win?.hide() },
      { type: 'separator' },
      { label: 'Open AUSTWise', click: () => shell.openExternal(SITE).catch(() => {}) },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ])
  );
  tray.on('click', () => showBubble());
  tray.on('double-click', () => showBubble());
}

// ── Drag (works for the bubble and for the card header) ────────────────────
ipcMain.on('bubble:drag-start', () => {
  if (!win) return;
  const bounds = win.getBounds();
  drag = { winX: bounds.x, winY: bounds.y };
});

ipcMain.on('bubble:drag-move', (_event, delta) => {
  if (!win || !drag || !delta) return;
  const bounds = win.getBounds();
  const pos = clampToWorkArea(
    drag.winX + Number(delta.dx || 0),
    drag.winY + Number(delta.dy || 0),
    bounds.width,
    bounds.height
  );
  win.setPosition(pos.x, pos.y);
});

// ── Expand into the Quick Hub card / collapse back to the bubble ───────────
ipcMain.on('bubble:expand', () => {
  if (!win || expanded) return;
  const bounds = win.getBounds();
  bubbleAnchor = { x: bounds.x, y: bounds.y };
  // Grow upward and leftward so the card stays where the bubble was.
  const pos = clampToWorkArea(
    bounds.x + BUBBLE_SIZE - CARD.width,
    bounds.y + BUBBLE_SIZE - CARD.height,
    CARD.width,
    CARD.height
  );
  expanded = true;
  win.setBounds({ x: pos.x, y: pos.y, width: CARD.width, height: CARD.height });
  win.focus();
  win.webContents.send('bubble:expanded', true);
});

ipcMain.on('bubble:collapse', () => {
  if (!win || !expanded) return;
  expanded = false;
  const bounds = win.getBounds();
  const anchor = bubbleAnchor || { x: bounds.x, y: bounds.y };
  const pos = clampToWorkArea(anchor.x, anchor.y, BUBBLE_SIZE, BUBBLE_SIZE);
  win.setBounds({ x: pos.x, y: pos.y, width: BUBBLE_SIZE, height: BUBBLE_SIZE });
  win.webContents.send('bubble:expanded', false);
});

// ── Card actions ───────────────────────────────────────────────────────────
ipcMain.on('bubble:open-path', (_event, routePath) => {
  const path = typeof routePath === 'string' && routePath.startsWith('/') ? routePath : '/';
  shell.openExternal(SITE + path).catch(() => {});
});

ipcMain.on('bubble:toggle-pin', () => {
  pinned = !pinned;
  if (win) {
    win.setAlwaysOnTop(pinned, 'screen-saver');
    win.webContents.send('bubble:pin-state', pinned);
  }
});

ipcMain.on('bubble:dock', () => {
  if (!win) return;
  const bounds = win.getBounds();
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  win.setPosition(
    workArea.x + workArea.width - bounds.width - MARGIN,
    workArea.y + workArea.height - bounds.height - MARGIN
  );
});

ipcMain.on('bubble:quit', () => {
  app.quit();
});

// One bubble only.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    if (process.platform === 'darwin') app.dock?.hide();
    createWindow();
    createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('before-quit', () => {
    tray?.destroy();
    tray = null;
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
