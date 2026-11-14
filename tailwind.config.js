/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
        },
        accent: {
          50: '#fff7ed',
          500: '#f97316',
          600: '#ea580c',
        }
      },
      fontFamily: {
        sarabun: ['Sarabun', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'modern': '0 4px 20px -4px rgba(15, 23, 42, 0.05)',
        'float': '0 10px 30px -10px rgba(37, 99, 235, 0.15)',
        'modal': '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
      }
    },
  },
  plugins: [],
}
