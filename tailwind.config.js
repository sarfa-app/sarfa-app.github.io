/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#EDEFF1',
        card: '#FFFFFF',
        ink: '#16252C',
        // Тона из ТЗ затемнены: исходные #5E7079 и #6E7F87 не дают 4.5:1 на фоне.
        soft: '#53656E',
        faint: '#5B6D76',
        rule: '#D5DBDE',
        track: '#E3E7E9',
        ok: '#2F6F58',
        warn: '#B4762A',
        'warn-ink': '#8F5B1C',
        over: '#A63A2C',
        'b-ob': '#16252C',
        'b-fam': '#7A5230',
        'b-var': '#3B5F7A',
        'b-fund': '#2F6F58',
      },
      fontFamily: {
        sans: ['InterVariable', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.75rem', { lineHeight: '1rem' }],
      },
    },
  },
  plugins: [],
};
