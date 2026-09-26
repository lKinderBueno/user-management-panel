/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Open Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"SF Mono"', 'ui-monospace', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        ie: {
          blue: '#3970e1',
          'blue-hover': '#2c5ec2',
          'blue-dark': '#244fb0',
          'blue-light': '#eef2ff',
          green: '#2dce89',
          'green-hover': '#26af74',
          'green-light': '#e8faf1',
          red: '#f5365c',
          'red-hover': '#ec0c38',
          'red-light': '#feecee',
          warning: '#fb6340',
          'warning-light': '#fff5f2',
          info: '#11cdef',
          dark: '#172b4d',
          card: '#ffffff',
          border: '#e9ecef',
          'border-dark': '#dee2e6',
          muted: '#8898aa',
          heading: '#32325d',
          text: '#525f7f',
          bg: '#f8f9fe',
        },
      },
      boxShadow: {
        'argon': '0 0 2rem 0 rgba(136, 152, 170, .15)',
        'argon-sm': '0 1px 3px rgba(50, 50, 93, .15), 0 1px 0 rgba(0, 0, 0, .02)',
        'argon-btn': '0 4px 6px rgba(50, 50, 93, .11), 0 1px 3px rgba(0, 0, 0, .08)',
        'argon-btn-hover': '0 7px 14px rgba(50, 50, 93, .1), 0 3px 6px rgba(0, 0, 0, .08)',
        'argon-dropdown': '0 50px 100px rgba(50, 50, 93, .1), 0 15px 35px rgba(50, 50, 93, .15), 0 5px 15px rgba(0, 0, 0, .1)',
      },
    },
  },
  plugins: [],
}
