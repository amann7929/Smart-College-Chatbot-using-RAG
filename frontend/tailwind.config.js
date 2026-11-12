import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'] },
      colors: {
        navy: { 50: '#f1f4fb', 100: '#dde3f3', 200: '#b9c4e4', 300: '#8a9ccf', 400: '#5a72b6', 500: '#3b529a', 600: '#2c3f7c', 700: '#233163', 800: '#182248', 900: '#0f172a', 950: '#080d1d' },
        brand: { 50: '#eff4ff', 100: '#dbe6fe', 200: '#bfd3fe', 300: '#93b4fd', 400: '#6090fa', 500: '#3b6cf6', 600: '#2551eb', 700: '#1d40d8', 800: '#1e35af', 900: '#1e3289' },
        violet: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.04), 0 4px 16px rgba(15,23,42,.05)',
        pop: '0 10px 40px rgba(37,81,235,.18)',
      },
      keyframes: {
        'dot-bounce': { '0%, 80%, 100%': { transform: 'scale(.6)', opacity: '.4' }, '40%': { transform: 'scale(1)', opacity: '1' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { 'dot-bounce': 'dot-bounce 1.2s infinite ease-in-out' },
    },
  },
  plugins: [typography],
};
