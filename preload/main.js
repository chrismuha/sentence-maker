const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sentenceMakerSettings", {
  load: () => ipcRenderer.invoke("settings:load"),
  save: settings => ipcRenderer.invoke("settings:save", settings),
  getPath: () => ipcRenderer.invoke("settings:path")
});
