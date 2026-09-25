// Colours point at CSS variables (see src/index.css) so dark mode swaps in one place
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)", surface: "var(--surface)", soft: "var(--soft)", ink: "var(--ink)", muted: "var(--muted)",
        line: "var(--line)", blue: "var(--blue)", onblue: "var(--onblue)",
        owe: "var(--owe)", owesoft: "var(--owe-soft)", paid: "var(--paid)", paidsoft: "var(--paid-soft)",
        part: "var(--part)", partsoft: "var(--part-soft)", future: "var(--future)",
      },
      fontFamily: {
        serif: ['"Source Serif 4"', "Georgia", "serif"],
        sans: ['"Atkinson Hyperlegible"', "system-ui", "sans-serif"],
      },
    },
  },
};
