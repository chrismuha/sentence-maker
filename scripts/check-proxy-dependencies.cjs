#!/usr/bin/env node
// Keep Electron's proxy support without the unpatched sprintf-js logger chain.
const { readFileSync } = require('node:fs');
const path = require('node:path');
const projectRoot = path.resolve(__dirname, '..');
const lock = JSON.parse(readFileSync(path.join(projectRoot, 'package-lock.json'), 'utf8'));
for (const [name, entry] of Object.entries(lock.packages || {})) {
  if (!name.endsWith('/global-agent')) continue;
  if (Number(entry.version.split('.')[0]) < 4) {
    throw new Error('Unpatched proxy dependency chain restored; retain the global-agent@3 override.');
  }
  const agent = require(path.join(projectRoot, name));
  agent.bootstrap();
  if (!global.GLOBAL_AGENT) throw new Error('Electron download proxy bootstrap failed.');
}
console.log('Electron download proxy dependency check passed.');
