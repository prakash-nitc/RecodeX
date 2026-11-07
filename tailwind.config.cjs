const c = v => `rgb(var(--${v}) / <alpha-value>)`;
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'), surface: c('surface'), surface2: c('surface2'), line: c('line'), fg: c('fg'), muted: c('muted'),
        accent: c('accent'), accentfg: c('accentfg'), ok: c('ok'), warn: c('warn'), bad: c('bad'), none: c('none'), hot: c('hot'),
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', '"Manrope"', 'system-ui', 'sans-serif'],
        sans: ['"Manrope"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.06), 0 1px 1px rgb(var(--shadow) / 0.04)',
        pop: '0 16px 40px -12px rgb(var(--shadow) / 0.35), 0 4px 12px -4px rgb(var(--shadow) / 0.2)',
      },
      opacity: { 6: '0.06', 8: '0.08', 12: '0.12', 15: '0.15', 35: '0.35', 45: '0.45' },
    },
  },
  plugins: [],
};
