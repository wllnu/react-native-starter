// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Jest runs this file before every test file, with its globals in scope.
    files: ["jest.setup.js"],
    languageOptions: { globals: { jest: "readonly" } },
  },
]);
