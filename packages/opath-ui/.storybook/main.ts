import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import { labAliases } from "./aliases.ts";

const dir = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../src/lab/catalog/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {
      builder: { viteConfigPath: path.join(dir, "vite.config.ts") },
    },
  },
  async viteFinal(viteConfig) {
    viteConfig.resolve ??= {};
    const prev = viteConfig.resolve.alias;
    const asArray = Array.isArray(prev) ? prev : prev ? [prev] : [];
    viteConfig.resolve.alias = [...labAliases, ...asArray];
    return viteConfig;
  },
};

export default config;
