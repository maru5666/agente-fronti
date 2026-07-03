const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const adminDir = path.join(root, 'fronti-admin');
const backendDir = path.join(root, 'fronti-backend');
const adminStabilityDistPrefix = '.next-stability';
const adminStabilityDistDir = adminStabilityDistPrefix;
const runDevSmoke = process.argv.includes('--dev-smoke');
const runDevSmokeOnly = process.argv.includes('--dev-smoke-only');
const adminRoutes = [
  '/login',
  '/registro',
  '/dashboard',
  '/inventario',
  '/productos',
  '/catalogo',
  '/clientes',
  '/zonas-delivery',
  '/delivery',
  '/reportes',
  '/chat-fronti',
  '/configuracion',
  '/diagnostico',
];

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function log(message) {
  console.log(`\n[stability] ${message}`);
}

function run(command, args, options = {}) {
  const invocation = createInvocation(command, args);
  const label = [command, ...args].join(' ');
  log(label);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: 'inherit',
    shell: false,
  });

  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message ?? `Fallo el comando: ${label}`);
  }
}

function createInvocation(command, args) {
  if (process.platform === 'win32' && command === npmCmd) {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', ['npm', ...args].join(' ')],
    };
  }

  return { command, args };
}

function withNodeOption(env, option) {
  const current = env.NODE_OPTIONS ?? '';
  if (current.includes(option)) return env;
  return {
    ...env,
    NODE_OPTIONS: `${current} ${option}`.trim(),
  };
}

function removeDirectory(directory) {
  if (!fs.existsSync(directory)) return;
  log(`Limpiando ${path.relative(root, directory)}`);
  try {
    fs.rmSync(directory, { recursive: true, force: true });
  } catch (error) {
    console.warn(
      `[stability] No se pudo limpiar ${path.relative(root, directory)}: ${error.message}`,
    );
  }
}

function cleanupStabilityBuilds() {
  if (!fs.existsSync(adminDir)) return;

  for (const entry of fs.readdirSync(adminDir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith(adminStabilityDistPrefix)) {
      removeDirectory(path.join(adminDir, entry.name));
    }
  }
}

function readNormalized(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs
    .readFileSync(filePath, 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, '')
    .trim();
}

function readPrismaClientRelevantSchema(filePath) {
  if (!fs.existsSync(filePath)) return null;

  return fs
    .readFileSync(filePath, 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !line.trim().startsWith('@@index('))
    .join('\n')
    .replace(/\s+/g, '')
    .trim();
}

function prismaClientIsInSync() {
  const schema = readPrismaClientRelevantSchema(path.join(backendDir, 'prisma', 'schema.prisma'));
  const generatedSchema = readPrismaClientRelevantSchema(
    path.join(backendDir, 'node_modules', '.prisma', 'client', 'schema.prisma'),
  );

  return Boolean(schema && generatedSchema && schema === generatedSchema);
}

function ensurePrismaClient() {
  if (prismaClientIsInSync()) {
    log('Prisma Client ya esta sincronizado con schema.prisma; no se regenera el DLL bloqueado por Windows.');
    return;
  }

  run(npmCmd, ['run', 'prisma:generate'], { cwd: backendDir });
}

async function waitForHttp(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (response.status < 500) {
        clearTimeout(timer);
        return;
      }
    } catch {
      // Reintentar hasta agotar el tiempo total.
    } finally {
      clearTimeout(timer);
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error(`No respondio a tiempo: ${url}`);
}

async function assertHttpOk(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  let lastStatus = 'sin respuesta';

  while (Date.now() - startedAt <= timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
      });
      lastStatus = String(response.status);
      if (response.status >= 200 && response.status < 400) {
        clearTimeout(timer);
        return;
      }
    } catch (error) {
      lastStatus = error.message;
    } finally {
      clearTimeout(timer);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Ruta no cargo correctamente: ${url} (${lastStatus})`);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => {
        if (!port) {
          reject(new Error('No se pudo reservar un puerto libre.'));
          return;
        }
        resolve(port);
      });
    });
  });
}

function startProcess(command, args, options) {
  const invocation = createInvocation(command, args);
  const child = spawn(invocation.command, invocation.args, {
    cwd: options.cwd,
    env: { ...process.env, ...(options.env ?? {}) },
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));

  return child;
}

function stopProcessTree(child) {
  if (!child?.pid || child.killed) return;

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      shell: false,
    });
    return;
  }

  child.kill('SIGTERM');
}

async function withDevSmoke() {
  const backendPort = await getFreePort();
  const adminPort = await getFreePort();
  log(`Smoke test de servidores dev en puertos temporales: backend ${backendPort}, admin ${adminPort}`);
  const backend = startProcess(
    'node',
    [path.join(backendDir, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js'), 'start', '--watch'],
    {
    cwd: backendDir,
    env: withNodeOption({ PORT: String(backendPort) }, '--disable-warning=DEP0190'),
    },
  );
  const admin = startProcess(
    'node',
    [path.join(adminDir, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', String(adminPort)],
    {
    cwd: adminDir,
    env: withNodeOption(
      { NEXT_PUBLIC_API_URL: `http://localhost:${backendPort}` },
      '--disable-warning=DEP0190',
    ),
    },
  );

  try {
    await waitForHttp(`http://localhost:${backendPort}/health`, 180000);
    await waitForHttp(`http://localhost:${adminPort}/login`, 240000);
    for (const route of adminRoutes) {
      await assertHttpOk(`http://localhost:${adminPort}${route}`, 60000);
    }
  } finally {
    stopProcessTree(backend);
    stopProcessTree(admin);
  }
}

async function main() {
  if (runDevSmokeOnly) {
    await withDevSmoke();
    log('Smoke test de desarrollo completado correctamente.');
    return;
  }

  run(npmCmd, ['run', 'lint']);
  run(npmCmd, ['run', 'type-check']);
  run('node', ['scripts/check-encoding.js']);
  ensurePrismaClient();
  run(npmCmd, ['run', 'build'], { cwd: backendDir });
  run(npmCmd, ['run', 'test:skills'], { cwd: backendDir });
  run(npmCmd, ['run', 'check:database-encoding'], { cwd: backendDir });
  run(npmCmd, ['run', 'build'], {
    cwd: adminDir,
    env: { NEXT_DIST_DIR: adminStabilityDistDir, FRONTI_DISABLE_WEBPACK_CACHE: '1' },
  });
  run('node', ['scripts/check-encoding.js']);

  if (runDevSmoke) {
    await withDevSmoke();
  }

  log('Verificacion de estabilidad completada correctamente.');
}

main().catch((error) => {
  console.error(`\n[stability] ${error.message}`);
  process.exit(1);
});
