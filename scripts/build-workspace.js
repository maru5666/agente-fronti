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

run('npm', ['run', 'build:backend']);
run('npm', ['run', 'build:admin']);
