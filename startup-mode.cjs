'use strict';

const fs = require('fs');
const path = require('path');

function normalizeMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'offline' || mode === 'local' || mode === 'standalone') return 'offline';
  if (mode === 'cloud' || mode === 'online' || mode === 'remote') return 'cloud';
  return '';
}

function getCliMode(argv = process.argv.slice(2)) {
  for (const arg of argv) {
    if (arg === '--offline' || arg === '--local' || arg === '--standalone') return 'offline';
    if (arg === '--cloud' || arg === '--online' || arg === '--remote') return 'cloud';
    if (arg.startsWith('--startup-mode=')) return normalizeMode(arg.slice('--startup-mode='.length));
    if (arg.startsWith('--mode=')) return normalizeMode(arg.slice('--mode='.length));
  }
  return '';
}

function getStartupMode(options = {}) {
  const cliMode = getCliMode(options.argv);
  if (cliMode) return cliMode;

  const envMode = normalizeMode(process.env.MCR_STARTUP_MODE || process.env.STARTUP_MODE || process.env.APP_STARTUP_MODE);
  if (envMode) return envMode;

  if (process.env.VITE_DEV_SERVER_URL || process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development') {
    return 'cloud';
  }

  return options.defaultMode || 'offline';
}

function hasCloudEndpoint(options = {}) {
  return Boolean(options.devServerUrl || process.env.VITE_DEV_SERVER_URL || process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL);
}

function getCloudUrl(defaultUrl, options = {}) {
  const url = options.devServerUrl
    || process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL
    || process.env.VITE_DEV_SERVER_URL
    || defaultUrl
    || '';

  if (!url || !options.hash) return url;
  return `${url.replace(/\/$/, '')}/#${options.hash}`;
}

function getLocalFileOptions(options = {}) {
  const fileOptions = { ...(options.fileOptions || {}) };
  if (options.hash && !fileOptions.hash) fileOptions.hash = options.hash;
  if (options.query && !fileOptions.query) fileOptions.query = options.query;
  return Object.keys(fileOptions).length ? fileOptions : undefined;
}

function resolveExistingFile(candidates) {
  const list = Array.isArray(candidates) ? candidates : [candidates];
  return list.find((candidate) => candidate && fs.existsSync(candidate)) || list.find(Boolean);
}

async function loadOffline(window, localFile, options = {}) {
  const resolvedLocalFile = resolveExistingFile(localFile);
  if (!resolvedLocalFile) {
    throw new Error('No offline renderer file was provided.');
  }
  return window.loadFile(resolvedLocalFile, getLocalFileOptions(options));
}

async function loadRenderer(window, options = {}) {
  const mode = getStartupMode(options);
  const cloudUrl = getCloudUrl(options.defaultCloudUrl, options);
  const localFile = options.localFile || options.offlineFile;
  const logger = options.logger || console;

  if (mode === 'offline' || !hasCloudEndpoint({ ...options, devServerUrl: cloudUrl })) {
    return loadOffline(window, localFile, options);
  }

  try {
    await window.loadURL(cloudUrl);
    return { mode: 'cloud', url: cloudUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn?.(`[startup] Cloud startup failed for ${cloudUrl}; switching to offline mode. ${message}`);
    await loadOffline(window, localFile, options);
    return { mode: 'offline', fallbackFrom: 'cloud', url: cloudUrl };
  }
}

module.exports = {
  getStartupMode,
  loadOffline,
  loadRenderer,
  resolveExistingFile,
};
