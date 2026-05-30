const { existsSync } = require('fs');
const { join, dirname } = require('path');
const { spawn, spawnSync } = require('child_process');

const scriptDir = dirname(__filename);
const sharedFile = process.argv[2];
const sharedArgs = process.argv.slice(3);
const projectRoot = join(scriptDir, '..');

process.env.NODE_DISABLE_COMPILE_CACHE = process.env.NODE_DISABLE_COMPILE_CACHE || '1';

function getArgValue(args, name) {
  const index = args.indexOf(name);
  return index !== -1 ? args[index + 1] : '';
}

function cleanupProjectDevProcesses() {
  if (process.platform === 'win32') return;

  const port = getArgValue(sharedArgs, '--port');
  const currentPid = String(process.pid);
  let output = '';

  try {
    output = spawnSync('ps', ['-ax', '-o', 'pid=,command='], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).stdout || '';
  } catch {
    return;
  }

  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const firstSpace = trimmed.indexOf(' ');
    const pid = firstSpace === -1 ? '' : trimmed.slice(0, firstSpace).trim();
    const command = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1);
    if (!pid || pid === currentPid) continue;

    const belongsToProject = command.includes(projectRoot);
    const isDevProcess = command.includes('Electron.app/Contents/MacOS/Electron')
      || command.includes('node_modules/.bin/electron')
      || command.includes('vite-electron-dev.mjs')
      || (command.includes('node_modules/.bin/vite') && (!port || command.includes(`--port ${port}`)))
      || (command.includes('/bin/esbuild') && belongsToProject);

    if (belongsToProject && isDevProcess) {
      try {
        process.kill(Number(pid), 'SIGKILL');
      } catch {
        // Ignore missing or already-exited processes.
      }
    }
  }
}

function signalChild(child, signal) {
  if (!child || child.killed) return;

  if (process.platform === 'win32' && child.pid) {
    const result = spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
    });

    if (result.status === 0) return;
  }

  try {
    if (process.platform !== 'win32' && child.pid) {
      process.kill(-child.pid, signal);
      return;
    }
  } catch {
    // Fall back to killing just the direct child.
  }

  try {
    child.kill(signal);
  } catch {
    // Ignore missing or already-exited processes.
  }
}

function waitForChildExit(child, timeoutMs = 1500) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  signalChild(child, 'SIGTERM');
  await waitForChildExit(child);

  if (child.exitCode === null && child.signalCode === null) {
    signalChild(child, 'SIGKILL');
    await waitForChildExit(child, 500);
  }
}

function runChild(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    cwd: join(scriptDir, '..'),
    detached: process.platform !== 'win32',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      MCR_DEV_PARENT_PID: String(process.pid),
    },
    ...options,
  });
  let shuttingDown = false;

  async function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    await stopChild(child);
    cleanupProjectDevProcesses();
    process.exitCode = code;
  }

  async function shutdownAndExit(code = 0) {
    await shutdown(code);
    process.exit(code);
  }

  process.on('SIGINT', () => void shutdownAndExit(130));
  process.on('SIGTERM', () => void shutdownAndExit(143));
  process.on('SIGBREAK', () => void shutdownAndExit(130));
  process.on('SIGHUP', () => void shutdownAndExit(129));
  process.on('exit', () => {
    signalChild(child, 'SIGKILL');
    cleanupProjectDevProcesses();
  });

  child.on('exit', (code) => {
    void shutdownAndExit(code ?? 0);
  });

  child.on('error', (error) => {
    process.stderr.write(`ERROR: Failed to start child process: ${error.message}\n`);
    void shutdownAndExit(1);
  });
}

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
    runChild(commandBin, args);
    return;
  }

  process.exit(0);
}

runChild(process.execPath, [sharedPath, ...sharedArgs]);
