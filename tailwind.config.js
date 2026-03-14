/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#1B2A4A',
        'sidebar-hover': '#243557',
        'sidebar-active': '#2D4270',
        brand: '#00875A',
        'brand-hover': '#006B47',
        'brand-light': '#E3F5EF',
      },
    },
  },
  plugins: [],
}
