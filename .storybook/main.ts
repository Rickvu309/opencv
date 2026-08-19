import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

const dir = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: [
    "./*.mdx",
    "../packages/opath-ui/src/*.stories.@(ts|tsx)",
    "../packages/opath-ui/src/gallery/**/*.stories.@(ts|tsx)",
    "../src/**/*.stories.@(ts|tsx)",
  ],
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs"],
  framework: {
    name: "@storybook/react-vite",
    options: {
      builder: { viteConfigPath: path.join(dir, "vite.config.ts") },
    },
  },
  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
  viteFinal: async (config) => {
    config.resolve = config.resolve ?? {};
    const aliases = [
      {
        find: "@/core/commands/client",
        replacement: path.join(dir, "stubs/commands-client.ts"),
      },
      {
        find: "@/core/auth/store",
        replacement: path.join(dir, "stubs/auth-store.ts"),
      },
      {
        find: "@/core/auth/session",
        replacement: path.join(dir, "stubs/auth-session.ts"),
      },
      {
        find: "@/core/db/client.server",
        replacement: path.join(dir, "stubs/db-client.ts"),
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
      const asObject: Record<string, string> = {
        ...(config.resolve.alias as Record<string, string> | undefined),
      };
      for (const alias of aliases) asObject[alias.find] = alias.replacement;
      config.resolve.alias = asObject;
    }
    return config;
  },
};

export default config;
