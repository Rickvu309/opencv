import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

const dir = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {
      builder: { viteConfigPath: path.join(dir, "vite.config.ts") },
    },
  },
  viteFinal: async (config) => {
    config.resolve = config.resolve ?? {};
    const aliases = [
      {
        find: "@/core/commands/client",
        replacement: path.join(dir, "stubs/commands-client.ts"),
      },
      {
        find: "@tanstack/react-start/server",
        replacement: path.join(dir, "stubs/react-start.ts"),
      },
      {
        find: "@tanstack/react-start",
        replacement: path.join(dir, "stubs/react-start.ts"),
      },
    ];
    if (Array.isArray(config.resolve.alias)) {
      config.resolve.alias = [...aliases, ...config.resolve.alias];
    } else {
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        "@/core/commands/client": aliases[0]!.replacement,
        "@tanstack/react-start/server": aliases[1]!.replacement,
        "@tanstack/react-start": aliases[2]!.replacement,
      };
    }
    return config;
  },
};

export default config;
