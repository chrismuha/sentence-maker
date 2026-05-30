const { spawn, spawnSync } = require('child_process');
const { join } = require('path');
const { existsSync } = require('fs');

const scriptDir = __dirname;
const projectRoot = join(scriptDir, '..');

function binPath(name) {
  const suffix = process.platform === 'win32' ? '.cmd' : '';
  const candidate = join(projectRoot, 'node_modules', '.bin', `${name}${suffix}`);
  return existsSync(candidate) ? candidate : name;
}

function signalChild(child, signal) {
  if (!child) return;

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

function isProcessAlive(pid) {
  if (!pid) return true;

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
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

const electronBin = binPath('electron');
const args = ['.', '--disable-cache', ...process.argv.slice(2)];
const env = { ...process.env };
// Ensure ELECTRON_RUN_AS_NODE is removed (unset)
if (Object.prototype.hasOwnProperty.call(env, 'ELECTRON_RUN_AS_NODE')) {
  delete env.ELECTRON_RUN_AS_NODE;
}
env.NODE_ENV = process.env.NODE_ENV || 'development';

const child = spawn(electronBin, args, {
  stdio: 'inherit',
  cwd: projectRoot,
  env,
  detached: process.platform !== 'win32',
  shell: process.platform === 'win32',
});
let shuttingDown = false;
let parentMonitor = null;

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  await stopChild(child);
  process.exitCode = code;
}

async function shutdownAndExit(code = 0) {
  await shutdown(code);
  if (parentMonitor) {
    clearInterval(parentMonitor);
    parentMonitor = null;
  }
  process.exit(code);
}

process.on('SIGINT', () => void shutdownAndExit(130));
process.on('SIGTERM', () => void shutdownAndExit(143));
process.on('SIGBREAK', () => void shutdownAndExit(130));
process.on('exit', () => signalChild(child, 'SIGKILL'));

const parentPid = Number.parseInt(process.env.MCR_DEV_PARENT_PID || '', 10);
if (Number.isInteger(parentPid) && parentPid > 0) {
  parentMonitor = setInterval(() => {
    if (process.ppid === 1 || !isProcessAlive(parentPid)) {
      void shutdownAndExit(0);
    }
  }, 500);
  parentMonitor.unref?.();
}

child.on('exit', (code) => {
  void shutdownAndExit(code ?? 0);
});

child.on('error', () => {
  void shutdownAndExit(1);
});
