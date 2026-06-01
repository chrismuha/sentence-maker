const { spawn, spawnSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');
const net = require('net');

const projectRoot = join(__dirname, '..');
const defaultPort = 5173;
const maxPort = 5200;

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

async function findFreePort(startPort = defaultPort) {
  for (let port = startPort; port <= maxPort; port += 1) {
    if (await checkPort(port)) {
      return port;
    }
  }
  return null;
}

function binPath(name) {
  const suffix = process.platform === 'win32' ? '.cmd' : '';
  const candidate = join(projectRoot, 'node_modules', '.bin', `${name}${suffix}`);
  return existsSync(candidate) ? candidate : name;
}

function spawnProcess(command, args, env) {
  if (process.platform === 'win32') {
    // Use cmd.exe /c to run .cmd wrappers or binaries reliably on Windows
    const cmdArgs = ['/c', command, ...args];
    return spawn('cmd.exe', cmdArgs, {
      cwd: projectRoot,
      env,
      stdio: 'inherit',
    });
  }
  return spawn(command, args, {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
    detached: true,
  });
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

function normalizeArgs() {
  const argv = process.argv.slice(2);
  const portArg = argv.find((arg) => arg.startsWith('--prefer-port='));
  if (portArg) {
    const value = portArg.split('=')[1];
    const port = Number(value);
    return Number.isInteger(port) && port > 0 ? port : defaultPort;
  }
  return defaultPort;
}

async function main() {
  const preferredPort = normalizeArgs();
  const freePort = await findFreePort(preferredPort);
  if (!freePort) {
    process.stderr.write(`No available port found between ${preferredPort} and ${maxPort}.\n`);
    process.exit(1);
  }

  const env = {
    ...process.env,
    NODE_DISABLE_COMPILE_CACHE: '1',
    VITE_DEV_SERVER_URL: `http://127.0.0.1:${freePort}/`,
    NODE_ENV: 'development',
    PORT: String(freePort),
  };
  delete env.ELECTRON_RUN_AS_NODE;

  const viteBin = binPath('vite');
  const electronBin = binPath('electron');

  const renderer = spawnProcess(viteBin, ['dev', '--host', '127.0.0.1', '--port', String(freePort)], env);
  const main = spawnProcess(electronBin, ['.', '--disable-cache', '--disable-gpu', '--disable-gpu-compositing', '--disable-logging', '--log-level=3'], env);

  let cleanupCalled = false;
  let parentMonitor = null;
  const cleanup = async (code) => {
    if (cleanupCalled) return;
    cleanupCalled = true;
    await Promise.all([
      stopChild(renderer),
      stopChild(main),
    ]);
    process.exitCode = code;
  };
  const cleanupAndExit = async (code) => {
    await cleanup(code);
    if (parentMonitor) {
      clearInterval(parentMonitor);
      parentMonitor = null;
    }
    process.exit(code);
  };

  process.on('SIGINT', () => void cleanupAndExit(130));
  process.on('SIGTERM', () => void cleanupAndExit(143));
  process.on('SIGBREAK', () => void cleanupAndExit(130));
  process.on('exit', () => {
    signalChild(renderer, 'SIGKILL');
    signalChild(main, 'SIGKILL');
  });

  const parentPid = Number.parseInt(process.env.MCR_DEV_PARENT_PID || '', 10);
  if (Number.isInteger(parentPid) && parentPid > 0) {
    parentMonitor = setInterval(() => {
      if (process.ppid === 1 || !isProcessAlive(parentPid)) {
        void cleanupAndExit(0);
      }
    }, 500);
    parentMonitor.unref?.();
  }

  renderer.on('exit', (code) => void cleanupAndExit(code ?? 1));
  renderer.on('error', () => void cleanupAndExit(1));
  main.on('exit', (code) => void cleanupAndExit(code ?? 0));
  main.on('error', () => void cleanupAndExit(1));
}

main().catch((error) => {
  process.stderr.write(`Failed to start local dev fallback: ${error.message}\n`);
  process.exit(1);
});
