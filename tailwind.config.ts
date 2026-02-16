import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './content/**/*.{md,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        card: 'var(--color-card)',
        text: 'var(--color-text)',
        muted: 'var(--color-muted)',
        accent: 'var(--color-accent)',
        border: 'var(--color-border)'
      },
      boxShadow: {
        card: '0 12px 30px -18px rgba(10, 14, 20, 0.45)'
      },
      fontFamily: {
        display: ['"Sora"', '"Avenir Next"', '"PingFang SC"', 'sans-serif'],
        body: ['"IBM Plex Sans"', '"PingFang SC"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SFMono-Regular"', 'monospace']
      }
    }
  },
  plugins: []
};

export default config;
