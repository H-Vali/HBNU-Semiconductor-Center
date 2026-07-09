import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['A2z', 'ui-sans-serif', 'system-ui']
      },
      colors: {
        navy: '#1E3A8A',
        surface: '#1E293B',
        base: '#0F172A',
        cyan: '#22D3EE',
        mint: '#34D399'
      }
    }
  },
  plugins: []
} satisfies Config;
