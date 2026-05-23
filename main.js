const { app, BrowserWindow, ipcMain } = require("electron");
if (require("electron-squirrel-startup")) {
  app.quit();
}

const fs = require("fs");
const path = require("path");
const { attachLiveReload } = require("../_shared/electron-live-reload.cjs");
const { loadRenderer } = require("./startup-mode.cjs");

function getBundledSettingsPath() {
  return path.join(__dirname, "settings.json");
}

function getUserSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function getDefaultSettings() {
  try {
    const raw = fs.readFileSync(getBundledSettingsPath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      shortcutKey: null,
      insertBlankLines: true
    };
  }
}

function ensureSettingsFile() {
  const settingsPath = getUserSettingsPath();
  const defaultSettings = getDefaultSettings();

  try {
    if (!fs.existsSync(settingsPath)) {
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
      return defaultSettings;
    }

    const raw = fs.readFileSync(settingsPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      shortcutKey: typeof parsed.shortcutKey === "string" ? parsed.shortcutKey : null,
      insertBlankLines: typeof parsed.insertBlankLines === "boolean"
        ? parsed.insertBlankLines
        : Boolean(defaultSettings.insertBlankLines)
    };
  } catch {
    return defaultSettings;
  }
}

function saveSettings(nextSettings) {
  const settingsPath = getUserSettingsPath();
  const defaultSettings = getDefaultSettings();
  const normalized = {
    shortcutKey: typeof nextSettings?.shortcutKey === "string" ? nextSettings.shortcutKey : null,
    insertBlankLines: typeof nextSettings?.insertBlankLines === "boolean"
      ? nextSettings.insertBlankLines
      : Boolean(defaultSettings.insertBlankLines)
  };

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(normalized, null, 2));
  return normalized;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload/main.js"),
      contextIsolation: true
    }
  });

  loadRenderer(win, {
    defaultCloudUrl: "http://localhost:5184",
    localFile: path.join(__dirname, "dist", "index.html"),
  });

  if (!app.isPackaged) {
    win.webContents.on("before-input-event", (event, input) => {
      const isDevToolsKey = input.key?.toLowerCase() === "i" || input.code === "KeyI";
      if (((input.meta && input.alt) || (input.control && input.shift)) && isDevToolsKey) {
        event.preventDefault();
        win.webContents.toggleDevTools();
      }
    });
    if (process.env.OPEN_DEVTOOLS === "1") win.webContents.openDevTools();
  }

  const stopWatching = attachLiveReload({
    enabled: !app.isPackaged,
    rootDir: __dirname,
    watchPaths: ["index.html", "styles.css", "script", "preload"],
    getWindows: () => [win],
  });

  win.on("closed", stopWatching);
}

app.whenReady().then(() => {
  ensureSettingsFile();

  ipcMain.handle("settings:load", () => ensureSettingsFile());
  ipcMain.handle("settings:save", (_event, nextSettings) => saveSettings(nextSettings));
  ipcMain.handle("settings:path", () => getUserSettingsPath());

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
