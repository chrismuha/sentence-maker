const { app, BrowserWindow, ipcMain, nativeImage } = require("electron");
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-logging');
app.commandLine.appendSwitch('log-level', '3');

if (require("electron-squirrel-startup")) {
  app.quit();
}

const fs = require("fs");
const path = require("path");
let attachLiveReload = () => () => {};
try {
  ({ attachLiveReload } = require("../_shared/electron-live-reload.cjs"));
} catch {
  // Shared live-reload helper is optional; continue without it.
}
const { loadRenderer } = require("./startup-mode.cjs");
const APP_NAME = "Sentence Maker";
const APP_ID = "com.muha.sentencemaker";

function applyAppIdentity() {
  app.setName(APP_NAME);
  app.setAppUserModelId(APP_ID);

  if (process.platform === "darwin") {
    app.setAboutPanelOptions({
      applicationName: APP_NAME,
      applicationVersion: app.getVersion()
    });
  }
}

applyAppIdentity();

function getResourceIconPath(fileName, fallbackFileNames = []) {
  const candidates = [
    path.join(process.resourcesPath, "assets", "icons", fileName),
    path.join(app.getAppPath(), "assets", "icons", fileName),
    path.join(__dirname, "assets", "icons", fileName),
    ...fallbackFileNames.flatMap((fallbackFileName) => [
      path.join(process.resourcesPath, "assets", "icons", fallbackFileName),
      path.join(app.getAppPath(), "assets", "icons", fallbackFileName),
      path.join(__dirname, "assets", "icons", fallbackFileName)
    ])
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function getAppIconPath() {
  return process.platform === "darwin"
    ? getResourceIconPath("icon.icns", ["icon.png"])
    : getResourceIconPath("icon.png", ["icon.icns"]);
}

function applyMacDockIcon() {
  if (process.platform !== "darwin" || !app.dock?.setIcon) {
    return;
  }

  const dockIcon = nativeImage.createFromPath(getResourceIconPath("icon.png", ["icon.icns"]));
  if (!dockIcon.isEmpty()) {
    app.dock.setIcon(dockIcon);
  }
}

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
      insertBlankLines: true,
      sortAlphabetically: false,
      preservePasteFormatting: true
    };
  }
}

function normalizeSentenceEndings(value, fallbackValue) {
  if (!Array.isArray(value)) {
    return Array.isArray(fallbackValue) ? fallbackValue : [];
  }

  return Array.from(new Set(
    value
      .filter(character => typeof character === "string")
      .flatMap(character => Array.from(character.trim()))
  ));
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
        : Boolean(defaultSettings.insertBlankLines),
      sortAlphabetically: typeof parsed.sortAlphabetically === "boolean"
        ? parsed.sortAlphabetically
        : Boolean(defaultSettings.sortAlphabetically),
      preservePasteFormatting: typeof parsed.preservePasteFormatting === "boolean"
        ? parsed.preservePasteFormatting
        : defaultSettings.preservePasteFormatting !== false,
      sentenceEndingCharacters: normalizeSentenceEndings(
        parsed.sentenceEndingCharacters,
        defaultSettings.sentenceEndingCharacters
      )
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
      : Boolean(defaultSettings.insertBlankLines),
    sortAlphabetically: typeof nextSettings?.sortAlphabetically === "boolean"
      ? nextSettings.sortAlphabetically
      : Boolean(defaultSettings.sortAlphabetically),
    preservePasteFormatting: typeof nextSettings?.preservePasteFormatting === "boolean"
      ? nextSettings.preservePasteFormatting
      : defaultSettings.preservePasteFormatting !== false,
    sentenceEndingCharacters: normalizeSentenceEndings(
      nextSettings?.sentenceEndingCharacters,
      defaultSettings.sentenceEndingCharacters
    )
  };

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(normalized, null, 2));
  return normalized;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    title: APP_NAME,
    icon: getAppIconPath(),
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
  applyAppIdentity();
  applyMacDockIcon();
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
  if (!app.isPackaged || process.platform !== "darwin") {
    app.quit();
  }
});
