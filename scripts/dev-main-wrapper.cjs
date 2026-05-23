const { spawnSync } = require('child_process');
const { join, dirname } = require('path');
const { existsSync } = require('fs');

const scriptDir = __dirname;
const projectRoot = join(scriptDir, '..');

function binPath(name) {
  const suffix = process.platform === 'win32' ? '.cmd' : '';
  const candidate = join(projectRoot, 'node_modules', '.bin', `${name}${suffix}`);
  return existsSync(candidate) ? candidate : name;
}

const electronBin = binPath('electron');
const args = ['.', '--disable-cache'];
const env = { ...process.env };
// Ensure ELECTRON_RUN_AS_NODE is removed (unset)
if (Object.prototype.hasOwnProperty.call(env, 'ELECTRON_RUN_AS_NODE')) {
  delete env.ELECTRON_RUN_AS_NODE;
}
env.NODE_ENV = 'development';

const result = spawnSync(electronBin, args, { stdio: 'inherit', cwd: projectRoot, env });
process.exit(result.status ?? 0);
