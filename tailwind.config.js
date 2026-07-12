/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        sidebar: "#f0eee6",
        surface: "#faf9f5",
        accent: "#c96442",
        ink: "#3d3929",
      },
    },
  },
  plugins: [],
};
