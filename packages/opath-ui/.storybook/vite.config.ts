import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

const dir = path.dirname(fileURLToPath(import.meta.url));
const lab = path.resolve(dir, "../src/lab");

export default defineConfig({
  plugins: [tsconfigPaths(), viteReact(), tailwindcss()],
  server: {
    watch: {
      ignored: [path.resolve(dir, "../../../.cache/**")],
    },
  },
  resolve: {
    alias: [
      { find: "@/lib/utils", replacement: path.resolve(dir, "../src/cn.ts") },
      { find: "@/lib/touch", replacement: path.resolve(lab, "beui/lib/touch.ts") },
      { find: "@/lib/tick-sound", replacement: path.resolve(lab, "beui/lib/tick-sound.ts") },
      { find: "@/lib/text-shimmer", replacement: path.resolve(lab, "beui/lib/text-shimmer.ts") },
      { find: "@/lab-hooks", replacement: path.resolve(lab, "hooks") },
      { find: "@/components/icons", replacement: path.resolve(lab, "stubs/brand-icons.tsx") },
      { find: "@/components/ui", replacement: path.resolve(lab, "kit") },
      { find: "@/components/kibo-ui", replacement: path.resolve(lab, "kibo") },
      { find: "next/navigation", replacement: path.resolve(lab, "stubs/next-navigation.ts") },
      { find: "next/dynamic", replacement: path.resolve(lab, "stubs/next-dynamic.tsx") },
      { find: "next-themes", replacement: path.resolve(lab, "stubs/next-themes.ts") },
      { find: "@repo/shadcn-ui/lib/utils", replacement: path.resolve(dir, "../src/cn.ts") },
      { find: "@repo/shadcn-ui/components/ui", replacement: path.resolve(lab, "kit") },
      { find: /^@repo\/(.*)$/, replacement: path.join(lab, "kibo/$1") },
    ],
  },
});
