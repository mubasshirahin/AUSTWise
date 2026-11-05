# AUSTWise desktop bubble

A tiny Electron app that keeps the AUSTWise chat head **on top of every desktop
app** — YouTube, VS Code, games, anything. A browser tab can never do this; an
always-on-top native window can.

## Run it

```bash
cd desktop
npm install      # downloads Electron (~100 MB, first time only)
npm start
```

## What it does

| Interaction | Result |
|---|---|
| Click the bubble | Grows into the **AUSTWise Quick Hub card** in place — no browser hop |
| Drag the bubble | Moves it anywhere (clamped to the screen) |
| Drag the card header | Moves the card |
| `Esc` / `×` | Collapses the card back to the bubble |
| Quick Jump buttons | Open that AUSTWise page in your default browser |
| `Pinned` | Toggles always-on-top for the window |
| `Dock` | Snaps the window to the bottom-right corner |
| `Quit` | Exits |
| Right-click the bubble | Fallback menu (`Open AUSTWise`, `Quit`) |

The bubble is **not** in the taskbar (`skipTaskbar: true`). It is controlled from
the **system tray icon**: left click shows it again, right click gives
`Show bubble` / `Hide bubble` / `Open AUSTWise` / `Quit`.

## Files

| File | Role |
|---|---|
| `main.js` | Window + tray + IPC: expand/collapse, drag, pin, dock, quit |
| `overlay.html` | The bubble and the Quick Hub card (plain HTML/CSS/JS, no bundler) |
| `preload.js` | Narrow `contextBridge` API (10 calls, `contextIsolation` + `sandbox`) |
| `make-tray-icon.js` | Regenerates `tray.png` from the logo geometry |
| `tray.png` | 32×32 tray icon (dark disc, white A/W, amber rule) |

## Notes

- Window is `alwaysOnTop` at `screen-saver` level, so full-screen video does not
  cover it.
- Dragging is clamped to the display work area, so the bubble cannot be lost
  off-screen.
- Change the destination URL in `main.js` (`const SITE = ...`).
- To rebuild the tray icon after tweaking the mark: `node make-tray-icon.js`.

## Build an installer (optional)

```bash
npm i -D electron-builder
npx electron-builder --win portable   # or --mac / --linux
```
