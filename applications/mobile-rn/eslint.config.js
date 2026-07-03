// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "src/domain/bacm/emojiAssets.generated.ts"],
  },
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
    },
  },
]);
