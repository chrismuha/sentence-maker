// Clear only metadata rejected by macOS signing. Never clear Dropbox/File Provider attributes.
const { execFileSync } = require('node:child_process');
function sanitizeBuildMetadata(targets, run = execFileSync) {
  for (const attribute of ['com.apple.FinderInfo', 'com.apple.ResourceFork']) {
    for (const target of targets) {
      try {
        run('xattr', ['-dr', attribute, target], { stdio: 'ignore', timeout: 30000 });
      } catch {
        // xattr also returns nonzero when the attribute is absent.
      }
    }
  }
}
module.exports = { sanitizeBuildMetadata };
