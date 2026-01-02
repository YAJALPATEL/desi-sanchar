import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: "class",
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // Your Custom Palette
                crimson: { DEFAULT: "#EF4444", dark: "#991B1B" },    // 45% Red
                nebula: { DEFAULT: "#8B5CF6", dark: "#5B21B6" },     // 20% Purple
                neon: { DEFAULT: "#4ADE80", dark: "#22C55E" },       // 10% Light Green
                sky: { DEFAULT: "#38BDF8", dark: "#0284C7" },        // 5% Sky Blue
            },
            animation: {
                "blob": "blob 7s infinite",
            },
            keyframes: {
                blob: {
                    "0%": { transform: "translate(0px, 0px) scale(1)" },
                    "33%": { transform: "translate(30px, -50px) scale(1.1)" },
                    "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
                    "100%": { transform: "translate(0px, 0px) scale(1)" },
                },
            },
        },
    },
    plugins: [],
};
export default config;