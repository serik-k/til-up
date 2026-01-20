/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        mint: '#98FFED',
        sunny: '#FFE66D',
        ink: '#0F172A',
      },
      borderRadius: {
        '3xl': '1.5rem',
      },
      boxShadow: {
        xl: '0 20px 50px -20px rgba(15, 23, 42, 0.25)',
        '2xl': '0 30px 80px -30px rgba(15, 23, 42, 0.35)',
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0px) rotate(-1deg)' },
          '50%': { transform: 'translateY(-10px) rotate(1deg)' },
        },
        breathe: {
          '0%, 100%': { transform: 'translateY(0px) scale(1)' },
          '50%': { transform: 'translateY(-4px) scale(1.02)' },
        },
        pulseHint: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.06)', opacity: '0.85' },
        },
        pop: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0)', opacity: '0' },
        },
        driftUp: {
          '0%': { transform: 'translateY(0px)', opacity: '1' },
          '100%': { transform: 'translateY(-22px)', opacity: '0' },
        },
      },
      animation: {
        floaty: 'floaty 4.5s ease-in-out infinite',
        breathe: 'breathe 3.2s ease-in-out infinite',
        pulseHint: 'pulseHint 1.6s ease-in-out infinite',
        pop: 'pop 220ms ease-out forwards',
        driftUp: 'driftUp 700ms ease-out forwards',
      },
    },
  },
  plugins: [],
};
