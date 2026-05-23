const { existsSync } = require('fs');
const { join, dirname } = require('path');
const { spawnSync } = require('child_process');

const scriptDir = dirname(__filename);
const repairFile = join(scriptDir, '..', '_shared', 'repair.mjs');

if (!existsSync(repairFile)) {
  process.exit(0);
}

const result = spawnSync(process.execPath, [repairFile, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

process.exit(result.status ?? 0);
