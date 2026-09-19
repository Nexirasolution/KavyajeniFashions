/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      animation: {
      marquee: 'marquee 30s linear infinite',
    },
    keyframes: {
      marquee: {
        '0%':   { transform: 'translateX(0%)' },
        '100%': { transform: 'translateX(-50%)' },
      },
    },
      colors: {
        brand: {
          pink: '#E91E8C',
          magenta: '#C2185B',
          rose: '#FF6FA5',
          green: '#8BC34A',
          deepgreen: '#5C9A2A',
          gold: '#D4A14A',
          cream: '#FFF8F0',
          ink: '#2B2024'
        }
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)']
      },
      boxShadow: {
        soft: '0 8px 30px -8px rgba(194,24,91,0.18)'
      },
      borderRadius: {
        xl2: '1.25rem'
      }
    }
  },
  plugins: []
};
