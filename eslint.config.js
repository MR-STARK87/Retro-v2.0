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
      // Empty catch blocks are an accepted idiom in this codebase
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    // Extracted browser scripts: runtime globals injected by other scripts
    // and CDN libraries, plus idioms (empty catch blocks, control-char regexes
    // in sanitizers) that are intentional in this codebase.
    files: ["public/js/**/*.js"],
    rules: {
      "no-undef": ["error", { typeof: true }],
      "no-empty": "off",
      "no-control-regex": "off",
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        RetroEvents: "readonly",
        VANTA: "readonly",
        THREE: "readonly",
        Quill: "readonly",
        marked: "readonly",
        loadScript: "readonly",
        escapeHtml: "readonly",
        goToSection: "readonly",
        closeReadMode: "readonly",
        openReadMode: "readonly",
        renderNotesList: "readonly",
        saveNote: "readonly",
        syncNotes: "readonly",
        enhanceWithRetro: "readonly",
        deleteNote: "readonly",
        toggleTheme: "readonly",
      },
    },
  },
  {
    files: ["src/**/*.js", "scripts/**/*.mjs"],
  },
];
