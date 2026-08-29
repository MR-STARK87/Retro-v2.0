import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/", "public/css/"],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": "warn",
      // Existing codebase throws replacement errors without { cause } —
      // warning-level until the pattern is cleaned up.
      "preserve-caught-error": "warn",
    },
  },
  {
    // EJS partials and views embed JS; eslint can't parse them, but the
    // extracted static files under public/js are lintable.
    files: ["src/**/*.js", "scripts/**/*.mjs", "public/js/**/*.js"],
  },
];
