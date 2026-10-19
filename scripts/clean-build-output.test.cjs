const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { cleanOutput } = require('./clean-build-output.cjs');

test('clean preserves custom placeholders in place while deleting generated output', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcr-clean-output-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const pkg = require('../package.json');
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.copyFileSync(path.join(__dirname, 'clean-build-output.cjs'), path.join(root, 'scripts/clean-build-output.cjs'));
  const outputs = pkg.scripts.clean.split(' ').slice(2);
  const markers = [];
  for (const output of outputs) {
    const dir = path.join(root, output);
    fs.mkdirSync(path.join(dir, 'nested'), { recursive: true });
    for (const relative of ['.gitkeep', 'nested/.gitkeep']) {
      const marker = path.join(dir, relative);
      fs.writeFileSync(marker, 'Custom tracked contents\n');
      fs.utimesSync(marker, new Date(1000000), new Date(1000000));
      markers.push({ marker, stat: fs.statSync(marker) });
    }
    fs.writeFileSync(path.join(dir, 'artifact'), 'generated');
    fs.mkdirSync(path.join(dir, 'empty'));
  }
  fs.mkdirSync(path.join(root, 'source'));
  fs.writeFileSync(path.join(root, 'source/keep'), 'source');
  fs.symlinkSync(path.join(root, 'source'), path.join(root, outputs[0], 'linked-output'), process.platform === 'win32' ? 'junction' : 'dir');
  for (let pass = 0; pass < 2; pass++) {
    execFileSync(pkg.scripts.clean, { cwd: root, shell: true });
    for (const { marker, stat } of markers) {
      assert.equal(fs.readFileSync(marker, 'utf8'), 'Custom tracked contents\n');
      assert.equal(fs.statSync(marker).ino, stat.ino);
      assert.equal(fs.statSync(marker).mtimeMs, stat.mtimeMs);
    }
    for (const output of outputs) {
      assert.deepEqual(fs.readdirSync(path.join(root, output)).sort(), ['.gitkeep', 'nested']);
    }
    assert.equal(fs.readFileSync(path.join(root, 'source/keep'), 'utf8'), 'source');
  }
  const empty = path.join(root, 'empty-output');
  fs.mkdirSync(empty);
  cleanOutput(empty);
  assert.equal(fs.existsSync(empty), false);
  assert.doesNotThrow(() => cleanOutput(empty));
});
