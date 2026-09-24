import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/pages/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}", "./src/app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: { amore: { 50:"#fffaf0", 100:"#fdf0d4", 400:"#e8a72f", 500:"#d99018", 600:"#bd7610", 900:"#20170b" } },
      boxShadow: { soft: "0 18px 60px rgba(0,0,0,.08)" }
    }
  },
  plugins: []
};
export default config;