const { spawn } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');
const net = require('net');

const projectRoot = join(__dirname, '..');
const defaultPort = 5184;
const maxPort = 5200;

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

async function findFreePort() {
  for (let port = defaultPort; port <= maxPort; port += 1) {
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
  });
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
  const main = spawnProcess(electronBin, ['.', '--disable-cache'], env);

  let cleanupCalled = false;
  const cleanup = (code) => {
    if (cleanupCalled) return;
    cleanupCalled = true;
    if (!renderer.killed) renderer.kill('SIGINT');
    if (!main.killed) main.kill('SIGINT');
    process.exit(code);
  };

  renderer.on('exit', (code) => cleanup(code ?? 1));
  renderer.on('error', () => cleanup(1));
  main.on('exit', (code) => cleanup(code ?? 1));
  main.on('error', () => cleanup(1));
}

main().catch((error) => {
  process.stderr.write(`Failed to start local dev fallback: ${error.message}\n`);
  process.exit(1);
});