import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import nextPlugin from '@next/eslint-plugin-next';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      '.next-build/**',
      '.next-stability/**',
      '**/.next/**',
      '**/.next-build/**',
      '**/.next-stability/**',
      '.next-stability*/**',
      '**/.next-stability*/**',
      'node_modules/**',
      'out/**',
      'next-env.d.ts',
      '*.config.*',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@next/next/no-img-element': 'off',
    },
  },
];

export default eslintConfig;
