const fs = require('node:fs');
const path = require('node:path');

// Preserve placeholders in place, including their contents and parent directories.
// Never traverse symlinks: generated links can point outside the output folder.
function cleanOutput(target, preserveDirectory = true) {
  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  if (!stat.isDirectory()) {
    fs.rmSync(target, { force: true });
    return;
  }
  for (const name of fs.readdirSync(target)) {
    if (name !== '.gitkeep') {
      // Release platform folders carry the ignore setting; keep their identity too.
      const preserveChild = preserveDirectory && path.basename(target) === 'release'
        && ['macos', 'windows', 'linux'].includes(name);
      cleanOutput(path.join(target, name), preserveChild);
    }
  }
  if (!preserveDirectory && fs.readdirSync(target).length === 0) fs.rmdirSync(target);
}

if (require.main === module) {
  for (const output of process.argv.slice(2)) cleanOutput(path.resolve(output));
}
module.exports = { cleanOutput };
