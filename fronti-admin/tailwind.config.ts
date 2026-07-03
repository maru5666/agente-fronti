import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#f8fafc',
        ivory: '#f8fafc',
        muted: '#9ca3af',
        line: 'rgba(248, 250, 252, 0.10)',
        panel: '#10131b',
        canvas: '#05060a',
        surface: '#0b0d12',
        brand: '#8b5cf6',
        blue: '#22d3ee',
        jade: '#34d399',
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      boxShadow: {
        panel: '0 28px 90px rgba(0, 0, 0, 0.42)',
      },
      borderRadius: {
        premium: '20px',
      },
    },
  },
  plugins: [],
};

export default config;
