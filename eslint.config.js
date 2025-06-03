import gnome from "@nyx_lyb3ra/eslint-config-gnome";
import tseslint from "typescript-eslint";

export default tseslint.config(gnome.configs.recommended, {
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
});
