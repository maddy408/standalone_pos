/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F7F5FC',
          100: '#EDE7F7',
          200: '#DDD2F0',
          300: '#C5B3E6',
          400: '#A98ADB',
          500: '#7652B5', // Primary Royal Purple
          600: '#5B3B91', // Hover Purple
          700: '#482D75',
          800: '#341E57',
          900: '#21133B',
          DEFAULT: '#7652B5',
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
