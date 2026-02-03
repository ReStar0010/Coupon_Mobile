import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        "bg-grey": "#f8f8f8",
        "sec-black": "#333",
        "bg-white": "#fff",
        "act-yellow": "#ffad31",
        "act-yellow-light": "#ffecbf",
        tomato: "#eb3223",
        mid: "#b8b8b8",
      },
      spacing: {},
      fontFamily: {
        jost: ["var(--font-jost)", "inter"],
      },
      borderRadius: {
        xl: "20px",
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        drawCheck: {
          '0%': { 
            'stroke-dasharray': '0, 100',
            'stroke-dashoffset': '0'
          },
          '100%': { 
            'stroke-dasharray': '100, 100',
            'stroke-dashoffset': '0'
          }
        }
      },
      animation: {
        fadeIn: 'fadeIn 0.6s ease-in-out forwards',
        drawCheck: 'drawCheck 0.6s ease-in-out 0.3s forwards'
      },
    },
    fontSize: {
      inherit: "inherit",
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
      "5xl": "3rem",
      "6xl": "4rem",
    },
  },
  plugins: [],
};
export default config;
