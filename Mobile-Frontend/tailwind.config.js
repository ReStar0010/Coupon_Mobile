/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,ts,tsx}', './app/**/*.{js,ts,tsx}', './components/**/*.{js,ts,tsx}'],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'login-bg': '#F8F8F8',
        'login-dark': '#1C1C1C',
        'login-border': '#505050',
        'login-gray': '#333333',
        'login-light-gray': '#707070',
        'login-orange': '#FFAD31',
        'toast-green': '#4CC38A',
        'toast-red': '#FF6369',
      },
    },
  },
  plugins: [],
};