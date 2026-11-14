// Colours come from CSS variables (src/index.css) so Dawn and Dusk share one token system.
// Semantic colours have a fill shade (DEFAULT: dots, bars, tints) and an `ink` shade for text that
// passes WCAG AA on cards in both themes.
const c = v => `rgb(var(--${v}) / <alpha-value>)`;
const sem = n => ({ DEFAULT: c(n), ink: c(`${n}-ink`) });
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'), sidebar: c('sidebar'), surface: c('surface'), surface2: c('surface2'), hover: c('hover'), line: c('line'),
        fg: c('fg'), muted: c('muted'), icon: c('icon'), scrim: c('scrim'), backdrop: c('backdrop'), onart: c('onart'),
        interactive: c('interactive'), selected: c('selected'),
        accent: sem('accent'), accentfg: c('accentfg'),
        ok: sem('ok'), warn: sem('warn'), bad: sem('bad'), idle: sem('none'), hot: sem('hot'), // grey is 'idle': a colour named 'none' collides with outline-none
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.05), 0 2px 8px -2px rgb(var(--shadow) / 0.06)',
        lift: '0 2px 4px rgb(var(--shadow) / 0.06), 0 12px 28px -12px rgb(var(--shadow) / 0.22)',
        pop: '0 20px 48px -16px rgb(var(--shadow) / 0.38), 0 6px 16px -6px rgb(var(--shadow) / 0.2)',
      },
      borderRadius: { '2.5xl': '1.25rem' },
      opacity: { 6: '0.06', 8: '0.08', 12: '0.12', 15: '0.15', 35: '0.35', 45: '0.45' },
      keyframes: {
        'page-in': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'pop-in': { '0%': { opacity: '0', transform: 'scale(.92)' }, '60%': { opacity: '1', transform: 'scale(1.03)' }, '100%': { transform: 'scale(1)' } },
        'rise': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } },
        'glow': { '0%,100%': { opacity: '.55' }, '50%': { opacity: '1' } },
        'twinkle': { '0%,100%': { opacity: '.25' }, '50%': { opacity: '1' } },
      },
      animation: {
        'page-in': 'page-in 180ms ease-out both',
        'pop-in': 'pop-in 320ms cubic-bezier(.2,.8,.2,1) both',
        'rise': 'rise 420ms cubic-bezier(.2,.8,.2,1) both',
        'glow': 'glow 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
