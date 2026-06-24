/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        jelly: {
          bg: '#101114',
          panel: '#1a1c22',
          card: '#20232c',
          hover: '#2a2e3a',
          accent: '#00a4dc',
          text: '#e6e8eb',
          muted: '#8a8f9c',
        },
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-500px 0' },
          '100%': { backgroundPosition: '500px 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.8s linear infinite',
      },
    },
  },
  plugins: [],
}
