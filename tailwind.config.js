/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'check-pop': 'checkPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
      transitionDuration: {
        350: '350ms',
        400: '400ms',
      },
    },
  },
  plugins: [],
};
