/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F4F7FB',
          100: '#E2EDF8',
          200: '#C5D8ED',
          300: '#9BBFE0',
          400: '#4A8CD2',
          500: '#0A4174', // Primary Royal Blue
          600: '#062E52', // Hover Royal Blue
          700: '#052441',
          800: '#041A30',
          900: '#02101F',
          DEFAULT: '#0A4174',
        },
        surface: {
          DEFAULT: 'var(--card-bg)',
          bg: 'var(--bg-main)',
          card: 'var(--card-bg)',
          secondary: 'var(--secondary-surface)',
          border: 'var(--border-color)',
        },
        themeText: {
          DEFAULT: 'var(--text-main)',
          main: 'var(--text-main)',
          muted: 'var(--text-secondary)',
        },
      },
    },
  },
  plugins: [],
};
