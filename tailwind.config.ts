import type { Config } from "tailwindcss";

const config: Config = {
  // BAGIAN INI PALING PENTING
content: [
  "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
  "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
],

  theme: {
    extend: {
      colors: {
        'pmi-red': '#DC2626', // red-600
        'pmi-dark': '#1F2937', // gray-800
        'pmi-light': '#F8F9FA', // gray-50
      },
      fontFamily: {
      sans: ['var(--font-inter)', 'sans-serif'],
      serif: ['var(--font-lora)', 'serif'],
    },
  }},
  plugins: [require('tailwindcss-animate'),], // Pastikan DaisyUI juga di-load
};

export default config;