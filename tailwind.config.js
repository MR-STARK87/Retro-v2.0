/** @type {import('tailwindcss').Config} */
export default {
  // EJS views + extracted static JS (class literals are picked up here)
  content: ["./src/views/**/*.ejs", "./public/js/**/*.js"],
  safelist: [
    // dynamically composed in public/js/chat.js message renderer:
    // bg-${isUser ? "gray-100" : "black"} / text-${isUser ? "gray-800" : "white"}
    "bg-gray-100",
    "bg-black",
    "text-gray-800",
    "text-white",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
