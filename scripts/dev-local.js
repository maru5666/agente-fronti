const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const adminDir = path.join(root, 'fronti-admin');
const backendDir = path.join(root, 'fronti-backend');
const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const adminUrl = 'http://localhost:3002';

const children = [];

function removeIfExists(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function cleanNextArtifacts() {
  removeIfExists(path.join(adminDir, '.next'));
  removeIfExists(path.join(adminDir, '.next-build'));
  removeIfExists(path.join(adminDir, '.next-stability'));
}

function start(name, cwd, args, env = {}) {
  const invocation =
    process.platform === 'win32'
      ? { command: 'cmd.exe', args: ['/d', '/s', '/c', 'npm', ...args] }
      : { command: 'npm', args };

  const child = spawn(invocation.command, invocation.args, {
    cwd,
    env: { ...process.env, ...env },
    shell: false,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  children.push(child);

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on('exit', (code) => {
    if (code && !shuttingDown) {
      console.error(`[${name}] Finalizó con código ${code}.`);
      shutdown(code);
    }
  });
}

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function httpIsAlive(url) {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2000),
    });
    return response.status < 500;
  } catch {
    return false;
  }
}

function portIsOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function main() {
  if (await httpIsAlive(`${backendUrl.replace(/\/$/, '')}/health`)) {
    console.log(`[backend] Reutilizando backend activo en ${backendUrl}`);
  } else if (await portIsOpen(3000)) {
    console.log('[backend] El puerto 3000 ya está ocupado; no se inicia otra instancia para evitar EADDRINUSE.');
  } else {
    start('backend', backendDir, ['run', 'start:dev']);
  }

  if (await httpIsAlive(adminUrl)) {
    console.log(`[admin] Reutilizando frontend activo en ${adminUrl}`);
  } else if (await portIsOpen(3002)) {
    console.log('[admin] El puerto 3002 ya está ocupado; no se inicia otra instancia para evitar EADDRINUSE.');
  } else {
    cleanNextArtifacts();
    start('admin', adminDir, ['run', 'dev', '--', '-p', '3002'], {
      NEXT_PUBLIC_API_URL: backendUrl,
    });
  }

  if (children.length === 0) {
    console.log('Fronti ya estaba activo localmente. Presiona Ctrl+C para cerrar este monitor.');
    setInterval(() => {}, 60_000);
  }
}

main().catch((error) => {
  console.error(error);
  shutdown(1);
});
