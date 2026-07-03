const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const adminDir = path.join(root, 'fronti-admin');
const distDir = process.env.NEXT_DIST_DIR || '.next-build';
const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm run build'] : ['run', 'build'];

const result = spawnSync(command, args, {
  cwd: adminDir,
  env: {
    ...process.env,
    NEXT_DIST_DIR: distDir,
    FRONTI_DISABLE_WEBPACK_CACHE: '1',
  },
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
