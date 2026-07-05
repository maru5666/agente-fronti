const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const backendDir = join(root, 'fronti-backend');
const requiredPaths = [
  join(backendDir, 'node_modules', '@prisma', 'client'),
  join(backendDir, 'node_modules', 'prisma'),
];

if (requiredPaths.every((path) => existsSync(path))) {
  process.exit(0);
}

console.log('Instalando dependencias locales del backend para Prisma/Nest...');
const command = 'npm';
const args = ['ci', '--workspaces=false'];
const executable = process.platform === 'win32' ? 'cmd.exe' : command;
const finalArgs =
  process.platform === 'win32' ? ['/d', '/s', '/c', command, ...args] : args;
const result = spawnSync(executable, finalArgs, {
  cwd: backendDir,
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
