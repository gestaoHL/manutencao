import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        metro: {
          navy:   '#1A2B4A',
          mid:    '#2E4A7A',
          orange: '#F47920',
          bg:     '#F5F7FA',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
