import 'dotenv/config';
import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } from 'electron';
import path from 'node:path';
import {
  addMeal,
  updateMeal,
  deleteMeal,
  getMealsForDate,
  getDailyTotals,
  addWeightLog,
  getWeightHistory,
  getSetting,
  setSetting,
} from './db';
import { estimateMacros } from './macros';

if (getSetting('fdcApiKey') === undefined && process.env.FDC_API_KEY) {
  setSetting('fdcApiKey', process.env.FDC_API_KEY);
}
if (getSetting('useFdc') === undefined) {
  setSetting('useFdc', 'false');
}

let win: BrowserWindow | null = null;
let tray: Tray | null = null;

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function getSavedBounds(): { x?: number; y?: number; width: number; height: number } {
  const saved = getSetting('windowBounds');
  if (!saved) return { width: 380, height: 560 };
  try {
    return { width: 380, height: 560, ...JSON.parse(saved) };
  } catch {
    return { width: 380, height: 560 };
  }
}

function saveBounds() {
  if (!win) return;
  setSetting('windowBounds', JSON.stringify(win.getBounds()));
}

function createWindow() {
  win = new BrowserWindow({
    ...getSavedBounds(),
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    transparent: true,
    backgroundColor: '#00000000',
    vibrancy: 'hud',
    visualEffectState: 'active',
    roundedCorners: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Widget-like behavior: float above other windows, but stay on this one
  // Space/desktop only (doesn't follow you to other desktops or fullscreen apps).
  win.setAlwaysOnTop(true, 'floating');

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.on('moved', saveBounds);
  win.on('resized', saveBounds);

  win.on('close', (e) => {
    if (!(app as any).isQuitting) {
      e.preventDefault();
      win?.hide();
    } else {
      saveBounds();
    }
  });
}

const TRAY_ICON_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAAPElEQVR42mNgGI7gPw5MdQMpsuA/iZgmhhJl+H8KMX0N/k8lPGrwcDJ46KVjmmZpmhZCNC02aVrQD04AAO8p/wHU9dUlAAAAAElFTkSuQmCC';

function createTray() {
  const icon = nativeImage.createFromDataURL(`data:image/png;base64,${TRAY_ICON_PNG_BASE64}`);
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Food Tracker');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Show/Hide',
        click: () => {
          if (win?.isVisible()) win.hide();
          else win?.show();
        },
      },
      {
        label: 'Quit',
        click: () => {
          (app as any).isQuitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on('click', () => {
    if (win?.isVisible()) win.hide();
    else win?.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers
ipcMain.handle('meals:getForDate', (_e, date: string) => getMealsForDate(date));
ipcMain.handle('meals:getTotals', (_e, date: string) => getDailyTotals(date));
ipcMain.handle('meals:delete', (_e, id: number) => deleteMeal(id));
ipcMain.handle('meals:update', (_e, id: number, fields: any) => updateMeal(id, fields));

ipcMain.handle('meals:add', async (_e, input: { date: string; category: string; description: string }) => {
  const useFdc = getSetting('useFdc') === 'true';
  const fdcApiKey = getSetting('fdcApiKey');
  const items = await estimateMacros(input.description, { useFdc, fdcApiKey });
  return items.map((item) =>
    addMeal({
      date: input.date,
      category: input.category,
      description: item.name,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
    })
  );
});

ipcMain.handle('weight:add', (_e, input: { date: string; weight_kg: number; note?: string }) =>
  addWeightLog(input)
);
ipcMain.handle('weight:history', (_e, startDate?: string, endDate?: string) =>
  getWeightHistory(startDate, endDate)
);

ipcMain.handle('settings:get', (_e, key: string) => getSetting(key));
ipcMain.handle('settings:set', (_e, key: string, value: string) => setSetting(key, value));
