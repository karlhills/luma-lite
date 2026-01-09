module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        charcoal: {
          900: '#0b0d10',
          800: '#11151b',
          700: '#161c24',
          600: '#1d2530'
        },
        mist: {
          500: '#8aa2b5',
          400: '#9fb5c6'
        },
        accent: {
          500: '#7ac8d6',
          400: '#8bd4e0'
        },
        amberlite: {
          500: '#d8b774'
        }
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem'
      },
      boxShadow: {
        soft: '0 10px 30px rgba(8, 12, 18, 0.6)',
        insetSoft: 'inset 0 1px 2px rgba(255, 255, 255, 0.12), inset 0 -8px 16px rgba(3, 6, 10, 0.7)',
        softGlow: '0 20px 45px rgba(7, 12, 18, 0.65), 0 0 16px rgba(122, 200, 214, 0.08)',
        innerHalo: 'inset 0 0 0 1px rgba(255, 255, 255, 0.06), inset 0 12px 22px rgba(6, 10, 14, 0.6)'
      },
      backgroundImage: {
        glass: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))',
        glow: 'radial-gradient(circle at top left, rgba(122, 200, 214, 0.25), transparent 55%)',
        surface: 'linear-gradient(160deg, rgba(18, 24, 31, 0.85), rgba(11, 15, 20, 0.65))'
      },
      fontFamily: {
        display: ['"Manrope"', 'ui-sans-serif', 'system-ui'],
        body: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui']
      },
      transitionTimingFunction: {
        soft: 'cubic-bezier(0.22, 1, 0.36, 1)'
      }
    }
  },
  plugins: []
};
