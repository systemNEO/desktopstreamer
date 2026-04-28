/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#1e1f22', surface: '#2b2d31', hover: '#35373c' },
        accent: { DEFAULT: '#5865f2', live: '#f04747' },
        text: { primary: '#f2f3f5', muted: '#b5bac1' }
      }
    }
  },
  plugins: []
};
