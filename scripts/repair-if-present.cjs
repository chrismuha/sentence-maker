// Bootstrap must run with Node alone, before package binaries are available.
process.env.NODE_DISABLE_COMPILE_CACHE = process.env.NODE_DISABLE_COMPILE_CACHE || '1';

const { existsSync } = require('fs');
const { join, dirname } = require('path');
const { spawnSync } = require('child_process');

const scriptDir = dirname(__filename);
const repairFileCandidates = [
  join(scriptDir, '..', '..', '_shared', 'repair.mjs'),
  join(scriptDir, '..', '_shared', 'repair.mjs'),
];
const repairFile = repairFileCandidates.find((candidate) => existsSync(candidate));

if (!repairFile) {
  process.exit(0);
}

const result = spawnSync(process.execPath, [repairFile, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
