const { spawnSync } = require('node:child_process');

function run(command, args) {
  const executable = process.platform === 'win32' ? 'cmd.exe' : command;
  const finalArgs =
    process.platform === 'win32' ? ['/d', '/s', '/c', command, ...args] : args;
  const result = spawnSync(executable, finalArgs, {
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('npx', ['--no-install', 'prisma', 'generate']);
run('npx', ['--no-install', 'nest', 'build']);
