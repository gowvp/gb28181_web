import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import reactRefresh from "eslint-plugin-react-refresh";

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ["**/*.{jsx,tsx}"] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  reactRefresh.configs.vite,
];
