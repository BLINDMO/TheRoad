/** @type {import('tailwindcss').Config} */
// Gilded Aces design tokens. Every component derives from this — no one-off hex values.
// Direction: deep bottle-green felt, aged brass/gold, warm cream, walnut chrome,
// single amber-orange accent for wins/CTAs. "Expensive, not loud."
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: '#0B3D2E',
          light: '#13513D',
          dark: '#072719',
          rail: '#0A3327',
        },
        brass: {
          DEFAULT: '#C9A24B',
          light: '#E4C878',
          dark: '#9A7A33',
          deep: '#6E5621',
        },
        cream: {
          DEFAULT: '#F2E9D8',
          dim: '#C7BFAE',
          mute: '#8C8473',
        },
        walnut: {
          DEFAULT: '#1A1410',
          light: '#2A211A',
          panel: '#211913',
          line: '#3A2E22',
        },
        amber: {
          DEFAULT: '#E8743B',
          light: '#F49A6B',
          glow: '#FFB37A',
        },
        ruby: '#B5304A',
        jade: '#2FA37C',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        slab: ['"Zilla Slab"', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        chip: '9999px',
        card: '0.7rem',
        panel: '1.1rem',
        pill: '2rem',
      },
      boxShadow: {
        chip: '0 4px 10px rgba(0,0,0,0.45), inset 0 2px 3px rgba(255,255,255,0.25), inset 0 -3px 5px rgba(0,0,0,0.4)',
        card: '0 8px 22px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.4)',
        panel: '0 18px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
        brass: '0 0 0 1px rgba(201,162,75,0.55), 0 6px 18px rgba(0,0,0,0.5)',
        glow: '0 0 24px rgba(232,116,59,0.55)',
        inset: 'inset 0 2px 8px rgba(0,0,0,0.55)',
      },
      backgroundImage: {
        'felt-radial':
          'radial-gradient(ellipse at 50% 38%, #13513D 0%, #0B3D2E 45%, #072719 100%)',
        'brass-sheen':
          'linear-gradient(135deg, #E4C878 0%, #C9A24B 40%, #9A7A33 60%, #E4C878 100%)',
        'walnut-grain':
          'linear-gradient(160deg, #2A211A 0%, #1A1410 60%, #120D09 100%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-glow': {
          '0%,100%': { boxShadow: '0 0 14px rgba(232,116,59,0.35)' },
          '50%': { boxShadow: '0 0 28px rgba(232,116,59,0.75)' },
        },
        'coin-pop': {
          '0%': { opacity: '0', transform: 'scale(0.4)' },
          '60%': { opacity: '1', transform: 'scale(1.12)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.2,0.7,0.2,1) both',
        shimmer: 'shimmer 2.4s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'coin-pop': 'coin-pop 0.5s cubic-bezier(0.2,0.8,0.2,1) both',
      },
    },
  },
  plugins: [],
};
