const { app, BrowserWindow, ipcMain, screen, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

let libraryFile, scoresFile;

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let win;

function createWindow() {
  const { bounds } = screen.getPrimaryDisplay();

  win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });

  if (process.platform === 'darwin') app.dock.hide();
}

ipcMain.on('set-interactive', (_, interactive) => {
  win?.setIgnoreMouseEvents(!interactive, { forward: true });
});

ipcMain.handle('pick-music', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: 'Choose a music file',
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const filePath = result.filePaths[0];
  const data = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mimeMap = { mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg', m4a:'audio/mp4', aac:'audio/aac', flac:'audio/flac' };
  const mime = mimeMap[ext] || 'audio/mpeg';
  return {
    dataUrl: `data:${mime};base64,${data.toString('base64')}`,
    name: path.basename(filePath, path.extname(filePath)),
    filePath,
  };
});

function loadAudioFile(filePath) {
  const data = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mimeMap = { mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg', m4a:'audio/mp4', aac:'audio/aac', flac:'audio/flac' };
  const mime = mimeMap[ext] || 'audio/mpeg';
  return { dataUrl: `data:${mime};base64,${data.toString('base64')}`, ok: true };
}

ipcMain.handle('get-library', () => readJson(libraryFile, []));

ipcMain.handle('add-to-library', (_, { id, name, filePath }) => {
  const lib = readJson(libraryFile, []);
  if (!lib.find(e => e.id === id)) {
    lib.unshift({ id, name, filePath, addedAt: new Date().toISOString() });
    writeJson(libraryFile, lib);
  }
  return lib;
});

ipcMain.handle('remove-from-library', (_, id) => {
  const lib = readJson(libraryFile, []).filter(e => e.id !== id);
  writeJson(libraryFile, lib);
  const scores = readJson(scoresFile, {});
  delete scores[id];
  writeJson(scoresFile, scores);
  return lib;
});

ipcMain.handle('load-library-track', (_, filePath) => {
  try { return loadAudioFile(filePath); }
  catch { return { ok: false }; }
});


app.whenReady().then(() => {
  libraryFile = path.join(app.getPath('userData'), 'library.json');
  scoresFile  = path.join(app.getPath('userData'), 'scores.json');
  createWindow();
  globalShortcut.register('CommandOrControl+Shift+Q', () => app.quit());
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
