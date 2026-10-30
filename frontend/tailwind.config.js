/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        alabaster: {
          50: '#FAF9F5',
          100: '#F3F1EA',
          200: '#E6E3D8',
          300: '#D5D0C0',
        },
        volcanic: {
          800: '#1E2024',
          900: '#141517',
          950: '#0B0C0E',
        },
        coral: {
          50: '#FFF4F1',
          100: '#FFE4DE',
          500: '#FF6B4A',
          600: '#E85332',
          700: '#C43E20',
        },
      },
      boxShadow: {
        'bento': '0 1px 2px rgba(20, 21, 23, 0.03), 0 8px 24px -4px rgba(20, 21, 23, 0.04)',
        'bento-hover': '0 4px 12px rgba(20, 21, 23, 0.05), 0 16px 32px -6px rgba(20, 21, 23, 0.08)',
        'obsidian': '0 20px 40px -15px rgba(11, 12, 14, 0.35)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.65' },
          '50%': { transform: 'scale(1.22)', opacity: '0.18' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'pulse-ring': 'pulse-ring 2.6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
