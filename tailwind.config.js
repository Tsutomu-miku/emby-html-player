/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        jelly: {
          bg: '#071018',
          panel: '#0f171f',
          card: '#141e27',
          hover: '#1e2a35',
          accent: '#64d86b',
          text: '#f3f6f7',
          muted: '#9aa6ad',
        },
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-500px 0' },
          '100%': { backgroundPosition: '500px 0' },
        },
        menuIn: {
          '0%': { opacity: '0', transform: 'translateY(-6px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.8s linear infinite',
        menuIn: 'menuIn 160ms ease-out',
      },
    },
  },
  plugins: [],
}
