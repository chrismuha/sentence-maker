const { existsSync } = require('fs');
const { join, dirname } = require('path');
const { spawnSync } = require('child_process');

const scriptDir = dirname(__filename);
const sharedFile = process.argv[2];
const sharedArgs = process.argv.slice(3);

if (!sharedFile) {
  process.stderr.write('ERROR: Missing shared script path argument.\n');
  process.exit(1);
}

const sharedPathCandidates = [
  join(scriptDir, '..', sharedFile),
  join(scriptDir, sharedFile),
];
const sharedPath = sharedPathCandidates.find((candidate) => existsSync(candidate));
if (!sharedPath) {
  process.stdout.write(`Skipping missing shared helper: ${sharedFile}\n`);
  const helperName = sharedFile.split('/').pop();
  const fallbackCommands = {
    'vite-electron-dev.mjs': ['node', [join(scriptDir, 'start-local-fallback.cjs'), '--prefer-port=5184']],
  };

  const fallback = fallbackCommands[helperName];
  if (fallback) {
    const [command, args] = fallback;
    const commandBin = command === 'node' ? process.execPath : command;
    const result = spawnSync(commandBin, args, {
      stdio: 'inherit',
      cwd: join(scriptDir, '..'),
    });
    process.exit(result.status ?? 0);
  }

  process.exit(0);
}

const result = spawnSync(process.execPath, [sharedPath, ...sharedArgs], {
  stdio: 'inherit',
});

process.exit(result.status ?? 0);
