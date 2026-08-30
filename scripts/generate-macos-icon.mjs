#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const sourcePng = path.join(root, "assets", "icons", "icon.png");
const icoPngDir = path.join(root, "assets", "icons", "ico-pngs");
const targetIcns = path.join(root, "assets", "icons", "icon.icns");
const targetIco = path.join(root, "assets", "icons", "icon.ico");
const tempIcns = getTempPathFor(targetIcns);
const tempIco = getTempPathFor(targetIco);
const icnsSourceStampPath = getSourceStampPath(targetIcns);
const icoSourceStampPath = getSourceStampPath(targetIco);

function getTempPathFor(targetPath) {
  const parsed = path.parse(targetPath);
  return path.join(parsed.dir, `${parsed.name}.tmp${parsed.ext}`);
}

function getSourceStampPath(targetPath) {
  return `${targetPath}.source.sha256`;
}

function hashFile(filePath) {
  const data = fs.readFileSync(filePath);
  return createHash("sha256").update(data).digest("hex");
}

function replaceFileIfChanged(tempPath, targetPath) {
  const targetExists = fs.existsSync(targetPath);
  const fileChanged = !targetExists || !fs.readFileSync(targetPath).equals(fs.readFileSync(tempPath));

  if (fileChanged) {
    fs.renameSync(tempPath, targetPath);
    console.log(`Updated ${targetPath}`);
    return;
  }

  fs.rmSync(tempPath, { force: true });
  console.log(`No icon content change detected; kept existing ${targetPath}`);
}

function shouldSkipGeneration(targetPath, sourceStampPath, sourceHash) {
  if (!fs.existsSync(targetPath) || !fs.existsSync(sourceStampPath)) {
    return false;
  }

  const previousSourceHash = fs.readFileSync(sourceStampPath, "utf8").trim();
  if (previousSourceHash !== sourceHash) {
    return false;
  }

  console.log(`No source icon change detected; kept existing ${targetPath}`);
  return true;
}

function generateIco(sourceHash) {
  if (shouldSkipGeneration(targetIco, icoSourceStampPath, sourceHash)) {
    return;
  }

  const sizes = [16, 24, 32, 48, 64, 128, 256];

  fs.rmSync(icoPngDir, { recursive: true, force: true });
  fs.mkdirSync(icoPngDir, { recursive: true });

  try {
    const pngEntries = sizes.map((size) => {
      const filePath = path.join(icoPngDir, `icon_${size}.png`);
      execFileSync("sips", ["-z", String(size), String(size), sourcePng, "--out", filePath], { stdio: "ignore" });
      return { size, data: fs.readFileSync(filePath) };
    });

    const headerSize = 6;
    const directoryEntrySize = 16;
    const imageOffsetStart = headerSize + pngEntries.length * directoryEntrySize;
    const directory = Buffer.alloc(imageOffsetStart);

    directory.writeUInt16LE(0, 0);
    directory.writeUInt16LE(1, 2);
    directory.writeUInt16LE(pngEntries.length, 4);

    let offset = imageOffsetStart;
    pngEntries.forEach((entry, index) => {
      const entryOffset = headerSize + index * directoryEntrySize;
      directory.writeUInt8(entry.size === 256 ? 0 : entry.size, entryOffset);
      directory.writeUInt8(entry.size === 256 ? 0 : entry.size, entryOffset + 1);
      directory.writeUInt8(0, entryOffset + 2);
      directory.writeUInt8(0, entryOffset + 3);
      directory.writeUInt16LE(1, entryOffset + 4);
      directory.writeUInt16LE(32, entryOffset + 6);
      directory.writeUInt32LE(entry.data.length, entryOffset + 8);
      directory.writeUInt32LE(offset, entryOffset + 12);
      offset += entry.data.length;
    });

    fs.writeFileSync(tempIco, Buffer.concat([directory, ...pngEntries.map((entry) => entry.data)]));
    replaceFileIfChanged(tempIco, targetIco);
    fs.writeFileSync(icoSourceStampPath, `${sourceHash}\n`, "utf8");
  } finally {
    fs.rmSync(icoPngDir, { recursive: true, force: true });
  }
}

function generateIcns(sourceHash) {
  if (process.platform !== "darwin") {
    console.log("Skipping macOS .icns generation (non-darwin host).");
    return;
  }

  if (shouldSkipGeneration(targetIcns, icnsSourceStampPath, sourceHash)) {
    return;
  }

  const sizes = [16, 32, 128, 256, 512];
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sentence-maker-icon-"));
  const iconsetDir = path.join(tempRoot, "icon.iconset");

  fs.mkdirSync(iconsetDir, { recursive: true });

  try {
    for (const size of sizes) {
      const oneX = path.join(iconsetDir, `icon_${size}x${size}.png`);
      const twoX = path.join(iconsetDir, `icon_${size}x${size}@2x.png`);

      execFileSync("sips", ["-z", String(size), String(size), sourcePng, "--out", oneX], { stdio: "ignore" });
      execFileSync("sips", ["-z", String(size * 2), String(size * 2), sourcePng, "--out", twoX], { stdio: "ignore" });
    }

    execFileSync("iconutil", ["-c", "icns", iconsetDir, "-o", tempIcns], { stdio: "ignore" });
    replaceFileIfChanged(tempIcns, targetIcns);
    fs.writeFileSync(icnsSourceStampPath, `${sourceHash}\n`, "utf8");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (!fs.existsSync(sourcePng)) {
  console.error(`Missing source icon: ${sourcePng}`);
  process.exit(1);
}

const sourceHash = hashFile(sourcePng);
generateIco(sourceHash);
generateIcns(sourceHash);
