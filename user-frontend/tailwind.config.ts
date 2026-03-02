import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        app: {
          bg: "#0F0A1A",
          card: "#151221",
          cardBorder: "#251E3A",
          highlightCardFrom: "#221844",
          highlightCardTo: "#150F2D",
          highlightBorder: "#322359",
        },
        accent: {
          goldBg: "#241A22",
          goldText: "#E8C587",
          purpleBg: "#181335",
          purpleText: "#9176DD",
          cyanBg: "#112024",
          cyanText: "#32D6A5",
        },
        text: {
          primary: "#FFFFFF",
          secondary: "#8A849F",
        }
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      }
    },
  },
  plugins: [],
};
export default config;
