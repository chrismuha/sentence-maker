const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const svgPath = path.join(root, "assets", "icons", "icon.svg");
const pngPath = path.join(root, "assets", "icons", "icon.png");

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: {
      backgroundThrottling: false,
      offscreen: true
    }
  });

  const svg = fs.readFileSync(svgPath, "utf8");
  const html = `<!doctype html>
    <html>
      <head>
        <style>
          html, body {
            width: 1024px;
            height: 1024px;
            margin: 0;
            overflow: hidden;
            background: transparent;
          }
          svg {
            display: block;
            width: 1024px;
            height: 1024px;
          }
        </style>
      </head>
      <body>${svg}</body>
    </html>`;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise(resolve => setTimeout(resolve, 100));
  const image = await win.webContents.capturePage();
  fs.writeFileSync(pngPath, image.toPNG());
  await app.quit();
});
