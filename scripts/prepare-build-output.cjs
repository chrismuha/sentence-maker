// Canonical suite policy; mirrored into each app by sync-build-output-hooks.mjs.
// Only audited disposable output is listed in package.json:mcrBuildOutputs.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const allowedOutputs = new Set([
  'dist', 'renderer/dist', 'dist-electron', 'dist_electron', 'release', 'out',
  '.webpack', '.vite/build', 'android/build', 'android/app/build',
  'ios/build', 'ios/DerivedData',
]);

function dropboxAttribute(projectRoot, platform = process.platform) {
  if (platform !== 'darwin') return null;
  const normalized = projectRoot.split(path.sep).join('/');
  if (/\/Library\/CloudStorage\/Dropbox[^/]*(\/|$)/.test(normalized)) {
    return 'com.apple.fileprovider.ignore#P';
  }
  if (/\/Dropbox(?: \([^/]+\))?(\/|$)/.test(normalized)) return 'com.dropbox.ignored';
  return null;
}

function containsSymlink(projectRoot, relative) {
  let current = projectRoot;
  for (const segment of relative.split('/')) {
    current = path.join(current, segment);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }
  return false;
}

function prepareBuildOutputs(projectRoot = process.cwd(), options = {}) {
  const { platform = process.platform, run = spawnSync, warn = console.warn } = options;
  projectRoot = fs.realpathSync(projectRoot);
  const attribute = dropboxAttribute(projectRoot, platform);
  if (!attribute) return [];
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const outputs = pkg.mcrBuildOutputs || [];
  if (!Array.isArray(outputs) || outputs.some(output => !allowedOutputs.has(output))) {
    throw new Error('mcrBuildOutputs must contain only audited generated-output paths.');
  }
  const results = [];
  for (const relative of new Set(outputs)) {
    const output = path.join(projectRoot, relative);
    try {
      if (containsSymlink(projectRoot, relative)) throw new Error('symlinked output is not modified');
      fs.mkdirSync(output, { recursive: true });
      const read = run('xattr', ['-p', attribute, output], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      // Avoid repeatedly asking File Provider to transition an already ignored folder.
      if (read.status !== 0 || String(read.stdout).trim() !== '1') {
        const write = run('xattr', ['-w', attribute, '1', output], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        if (write.error || write.status !== 0) throw new Error(write.error?.message || String(write.stderr).trim() || 'xattr failed');
      }
      results.push({ output: relative, ignored: true });
    } catch (error) {
      warn(`Could not keep ${relative} local in Dropbox: ${error.message}`);
      results.push({ output: relative, ignored: false });
    }
  }
  return results;
}

module.exports = { allowedOutputs, dropboxAttribute, prepareBuildOutputs };
if (require.main === module) prepareBuildOutputs(process.argv[2] || process.cwd());
