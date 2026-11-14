/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ocean: {
          coral: '#E63946',
          cream: '#F1FAEE',
          aqua: '#A8DADC',
          steel: '#457B9D',
          navy: '#1D3557',
        },
        brand: {
          50: '#F1FAEE',
          100: '#E0F2F1',
          200: '#A8DADC',
          300: '#72ADC2',
          400: '#5B92B0',
          500: '#457B9D',
          600: '#34617F',
          700: '#1D3557',
          800: '#15263F',
          900: '#0E1A2B',
        },
        accent: {
          50: '#FDF2F3',
          100: '#FBE4E6',
          200: '#F7BAC0',
          500: '#E63946',
          600: '#D32836',
          700: '#B01E2A',
        }
      },
      fontFamily: {
        sans: ['"LINE Seed Sans TH"', 'system-ui', '-apple-system', 'sans-serif'],
        linesans: ['"LINE Seed Sans TH"', 'system-ui', '-apple-system', 'sans-serif'],
        sarabun: ['"LINE Seed Sans TH"', 'system-ui', '-apple-system', 'sans-serif'],
        prompt: ['"LINE Seed Sans TH"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'modern': '0 4px 20px -4px rgba(29, 53, 87, 0.08)',
        'float': '0 10px 30px -10px rgba(69, 123, 157, 0.20)',
        'modal': '0 25px 50px -12px rgba(29, 53, 87, 0.35)',
      }
    },
  },
  plugins: [],
}
