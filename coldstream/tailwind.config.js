/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0a0f1a',
          900: '#0f1524',
          850: '#141c30',
          800: '#1a2338',
          700: '#273250',
          600: '#3a4a70',
        },
        brand: {
          300: '#86b6ef',
          400: '#3987e5',
          500: '#2a78d6',
          600: '#256abf',
          700: '#1c5cab',
        },
        mint: { 400: '#1baf7a', 500: '#199e70' },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
