import path from "node:path"
import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import type { StorybookConfig } from "@storybook/react-vite"
import { mergeConfig } from "vite"

const uiSrc = fileURLToPath(new URL("../src", import.meta.url))

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // Autodocs in a monorepo misses props unless components are imported
  // from their source files (not a barrel) and react-docgen is used.
  typescript: {
    reactDocgen: "react-docgen",
    check: false,
  },
  async viteFinal(config) {
    return mergeConfig(config, {
      plugins: [tailwindcss()],
      resolve: {
        alias: {
          "@workspace/ui": uiSrc,
        },
      },
      // Storybook's Vite root is packages/ui; keep CSS @source paths stable.
      root: path.resolve(uiSrc, ".."),
    })
  },
}

export default config
