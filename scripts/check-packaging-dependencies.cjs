#!/usr/bin/env node

const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const universalPackage = require.resolve('@electron/universal/package.json', { paths: [projectRoot] });
const universalRoot = path.dirname(universalPackage);
const minimatchPackage = require.resolve('minimatch/package.json', { paths: [universalRoot] });
const minimatchRoot = path.dirname(minimatchPackage);
const bracePackage = require.resolve('brace-expansion/package.json', { paths: [minimatchRoot] });
const minimatchVersion = require(minimatchPackage).version;
const braceVersion = require(bracePackage).version;
const minimatchModule = require(path.join(minimatchRoot, require(minimatchPackage).main));
const matcher = minimatchModule.minimatch || minimatchModule;

if (typeof matcher !== 'function') {
  throw new TypeError(`Universal packaging minimatch@${minimatchVersion} is not callable.`);
}

const expanded = minimatchModule.braceExpand?.('Application-{arm64,x64}.app');
if (!Array.isArray(expanded) || expanded.length !== 2) {
  throw new Error(`Universal packaging brace expansion failed with minimatch@${minimatchVersion} and brace-expansion@${braceVersion}.`);
}

if (!matcher('Application-arm64.app', 'Application-{arm64,x64}.app')) {
  throw new Error(`Universal packaging glob matching failed with minimatch@${minimatchVersion} and brace-expansion@${braceVersion}.`);
}

console.log(`Universal packaging dependencies OK: minimatch@${minimatchVersion}, brace-expansion@${braceVersion}`);

