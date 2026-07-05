const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

function run(command, args, options = {}) {
  const executable = process.platform === 'win32' ? 'cmd.exe' : command;
  const finalArgs =
    process.platform === 'win32' ? ['/d', '/s', '/c', command, ...args] : args;
  const result = spawnSync(executable, finalArgs, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function generatePrismaClient() {
  const executable = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const finalArgs =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npx', '--no-install', 'prisma', 'generate']
      : ['--no-install', 'prisma', 'generate'];
  const result = spawnSync(executable, finalArgs, {
    encoding: 'utf8',
    shell: false,
  });

  if (result.status === 0) {
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    return;
  }

  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const clientPath = join(__dirname, '..', 'node_modules', '.prisma', 'client', 'index.js');
  const isLockedWindowsEngine =
    process.platform === 'win32' &&
    /EPERM: operation not permitted, rename/i.test(output) &&
    /query_engine-windows\.dll\.node/i.test(output) &&
    existsSync(clientPath);

  if (isLockedWindowsEngine) {
    console.warn(
      'Prisma Client ya existe y el motor de consulta está en uso por el servidor local. Se continúa con nest build.',
    );
    return;
  }

  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  process.exit(result.status ?? 1);
}

generatePrismaClient();
run('npx', ['--no-install', 'nest', 'build']);
