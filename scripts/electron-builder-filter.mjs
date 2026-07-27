#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
let fixElectronBuilderDep0190 = () => false;
try {
  const imported = await import('../../_shared/fix-electron-builder-dep0190.mjs');
  if (typeof imported.fixElectronBuilderDep0190 === 'function') {
    fixElectronBuilderDep0190 = imported.fixElectronBuilderDep0190;
  }
} catch {
  // Shared patch helper not available; continue without it.
}

const suppressedPatterns = ["duplicate dependency references"];

function sanitizeMacMetadata() {
  if (process.platform !== "darwin") return;

  const root = process.cwd();
  const targets = ["assets", "dist", "index.html", "main.js", "preload", "script", "styles.css"]
    .map((target) => path.resolve(root, target))
    .filter((target) => fs.existsSync(target));

  for (const target of targets) {
    try {
      if (fs.statSync(target).isDirectory()) {
        execFileSync("find", [target, "-name", "._*", "-delete"], { stdio: "ignore" });
      }
    } catch {
      // Keep build moving.
    }
  }

  if (targets.length === 0) return;

  try {
    execFileSync("xattr", ["-cr", ...targets], { stdio: "ignore" });
    process.stdout.write("  • sanitized macOS extended attributes before packaging\n");
  } catch {
    process.stderr.write("  • warning: failed to clear macOS extended attributes; continuing build\n");
  }
}

function getElectronBuilderCommand(cwd) {
  const binName = process.platform === "win32" ? "electron-builder.cmd" : "electron-builder";
  const localBin = path.join(cwd, "node_modules", ".bin", binName);
  return fs.existsSync(localBin) ? localBin : binName;
}

sanitizeMacMetadata();

const projectRoot = process.cwd();
if (fixElectronBuilderDep0190(projectRoot)) {
  process.stdout.write("  • patched electron-builder to avoid Node DEP0190\n");
}

const projectOutputDir = path.resolve(projectRoot, "release");
const tempOutputDir = path.join("/private", "tmp", "sentence-maker-electron-builder-output");
const rawUserArgs = process.argv.slice(2);
const ignoredArgs = rawUserArgs.filter((arg) => !arg.startsWith("-") && arg.includes(":"));
const userArgs = rawUserArgs.filter((arg) => !ignoredArgs.includes(arg));

if (ignoredArgs.length > 0) {
  process.stdout.write(`  • ignored npm script target args: ${ignoredArgs.join(", ")}\n`);
}

const hasCustomOutput = userArgs.some((arg) => arg.startsWith("--config.directories.output="));
const builderArgs = [...userArgs];
const requestedArch = userArgs.includes("--x64") && userArgs.includes("--arm64")
  ? "combined"
  : userArgs.includes("--universal")
  ? "universal"
  : userArgs.includes("--arm64")
    ? "arm64"
    : userArgs.includes("--x64")
      ? "x64"
      : null;

function shouldCopyArtifact(entryName) {
  if (!requestedArch) return true;
  if (entryName === "builder-debug.yml" || entryName === "latest-mac.yml") return true;

  if (requestedArch === "combined") {
    return entryName.endsWith(".exe") || entryName.endsWith(".exe.blockmap") || entryName === "latest.yml";
  }

  if (requestedArch === "universal") {
    return entryName.includes("universal") || entryName === "mac-universal";
  }
  if (requestedArch === "arm64") {
    return entryName.includes("arm64") || entryName === "mac-arm64";
  }
  if (requestedArch === "x64") {
    return (
      entryName === "mac" ||
      entryName === "mac-x64" ||
      entryName.includes("x64") ||
      (!entryName.includes("arm64") &&
        !entryName.includes("universal") &&
        /^Sentence ?Maker-.*\.(dmg|zip)(\.blockmap)?$/.test(entryName))
    );
  }

  return true;
}

function isMacBuildArtifact(entryName) {
  if (entryName === "builder-debug.yml" || entryName === "latest-mac.yml") return true;
  if (entryName === "mac" || entryName === "mac-arm64" || entryName === "mac-universal" || entryName === "mac-x64") {
    return true;
  }
  return /^Sentence ?Maker-.*\.(dmg|zip|blockmap)$/.test(entryName);
}

if (process.platform === "darwin" && !hasCustomOutput) {
  try {
    fs.rmSync(tempOutputDir, { recursive: true, force: true });
    fs.mkdirSync(tempOutputDir, { recursive: true });
    execFileSync("xattr", ["-cr", tempOutputDir], { stdio: "ignore" });
    builderArgs.push(`--config.directories.output=${tempOutputDir}`);
    process.stdout.write(`  • using isolated macOS build output ${tempOutputDir}\n`);
  } catch {
    process.stderr.write("  • warning: could not prepare isolated output dir; using default output dir\n");
  }
}

const child = spawn(getElectronBuilderCommand(projectRoot), builderArgs, {
  stdio: ["inherit", "pipe", "pipe"]
});

let stdoutBuffer = "";
let stderrBuffer = "";

function flushBufferedLines(text, out, final = false) {
  const lines = text.split(/\r?\n/);
  const last = lines.pop();
  for (const line of lines) {
    if (suppressedPatterns.some((pattern) => line.includes(pattern))) continue;
    out.write(`${line}\n`);
  }
  if (final && last && !suppressedPatterns.some((pattern) => last.includes(pattern))) {
    out.write(last);
  }
  return last ?? "";
}

child.stdout.on("data", (chunk) => {
  stdoutBuffer = flushBufferedLines(stdoutBuffer + chunk.toString(), process.stdout);
});

child.stderr.on("data", (chunk) => {
  stderrBuffer = flushBufferedLines(stderrBuffer + chunk.toString(), process.stderr);
});

child.on("exit", (code, signal) => {
  stdoutBuffer = flushBufferedLines(stdoutBuffer, process.stdout, true);
  stderrBuffer = flushBufferedLines(stderrBuffer, process.stderr, true);

  if (process.platform === "darwin" && code === 0 && !hasCustomOutput && fs.existsSync(tempOutputDir)) {
    try {
      fs.mkdirSync(projectOutputDir, { recursive: true });
      if (requestedArch && fs.existsSync(projectOutputDir)) {
        for (const existing of fs.readdirSync(projectOutputDir)) {
          if (!isMacBuildArtifact(existing)) continue;
          if (shouldCopyArtifact(existing)) continue;
          fs.rmSync(path.join(projectOutputDir, existing), { recursive: true, force: true });
        }
      }
      const copied = [];
      for (const entry of fs.readdirSync(tempOutputDir)) {
        if (!shouldCopyArtifact(entry)) continue;
        fs.rmSync(path.join(projectOutputDir, entry), { recursive: true, force: true });
        execFileSync("cp", ["-R", path.join(tempOutputDir, entry), projectOutputDir], { stdio: "ignore" });
        copied.push(entry);
      }
      process.stdout.write(`  • copied build artifacts to ${projectOutputDir}\n`);
      if (requestedArch) {
        process.stdout.write(`  • filtered artifacts for ${requestedArch}: ${copied.join(", ") || "none"}\n`);
      }
    } catch (error) {
      process.stderr.write(`  • warning: build succeeded but copy to ${projectOutputDir} failed: ${error.message}\n`);
    }
  }

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
