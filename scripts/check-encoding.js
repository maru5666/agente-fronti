const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const allowedExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.css',
  '.scss',
  '.prisma',
  '.env',
  '.example',
  '.yml',
  '.yaml',
  '.mjs',
  '.cjs',
  '.html',
  '.txt',
]);
const ignoredDirectories = new Set([
  '.git',
  '.next',
  '.next-build',
  '.next-stability',
  'dist',
  'node_modules',
  'coverage',
  '.cache',
  'uploads',
]);
const ignoredSuffixes = ['.log', '.tsbuildinfo', 'package-lock.json'];
const damagedPattern = /[\u00c3\u00c2\ufffd]|\u00e2[\u0080-\u20ac]|\u00f0\u0178/;
const suspiciousReplacementQuestionPattern = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]\?[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/;

const failures = [];

function shouldRead(filePath) {
  const name = path.basename(filePath);
  const ext = path.extname(filePath);
  if (ignoredSuffixes.some((suffix) => name.endsWith(suffix))) return false;
  if (name.startsWith('.env')) return true;
  return allowedExtensions.has(ext) || allowedExtensions.has(name);
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name) && !entry.name.startsWith('.next-stability')) {
        walk(path.join(directory, entry.name));
      }
      continue;
    }

    const filePath = path.join(directory, entry.name);
    if (!shouldRead(filePath)) continue;

    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (hasEncodingDamage(line)) {
        failures.push(`${path.relative(root, filePath)}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

function hasEncodingDamage(line) {
  if (damagedPattern.test(line)) {
    return true;
  }

  if (!suspiciousReplacementQuestionPattern.test(line)) {
    return false;
  }

  if (
    line.includes('http://') ||
    line.includes('https://') ||
    line.includes('DATABASE_URL') ||
    line.includes('?query=') ||
    line.includes('searchParams') ||
    line.includes('?.') ||
    line.includes('?:') ||
    line.includes('??') ||
    line.includes('\\?')
  ) {
    return false;
  }

  return true;
}

walk(root);

if (failures.length) {
  console.error('Se detectaron caracteres corruptos o mojibake:');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Codificación verificada: UTF-8 sin caracteres corruptos.');
