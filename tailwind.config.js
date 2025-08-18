/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'metro-blue': '#0066CC',
        'metro-yellow': '#FFD700',
        'metro-red': '#DC143C',
        'metro-green': '#228B22',
        'metro-magenta': '#FF1493',
        'metro-orange': '#FF8C00',
        'metro-rapid': '#00aaff',
      }
    },
  },
  plugins: [],
}
