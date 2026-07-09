const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sentenceMakerSettings", {
  load: () => ipcRenderer.invoke("settings:load"),
  save: settings => ipcRenderer.invoke("settings:save", settings),
  getPath: () => ipcRenderer.invoke("settings:path"),
  getFileStatus: () => ipcRenderer.invoke("settings:file-status"),
  setFileDir: () => ipcRenderer.invoke("settings:set-file-dir"),
  resetFileDir: () => ipcRenderer.invoke("settings:reset-file-dir"),
  getAppVersion: () => ipcRenderer.invoke("app:version")
});
