import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const lab = path.resolve(dir, "../src/lab");

export const labAliases = [
  { find: "@/lib/utils", replacement: path.resolve(dir, "../src/cn.ts") },
  { find: "@/lib/touch", replacement: path.resolve(lab, "beui/lib/touch.ts") },
  { find: "@/lib/tick-sound", replacement: path.resolve(lab, "beui/lib/tick-sound.ts") },
  { find: "@/lib/text-shimmer", replacement: path.resolve(lab, "beui/lib/text-shimmer.ts") },
  { find: "@/lab-hooks", replacement: path.resolve(lab, "hooks") },
  { find: "@/components/app/icons", replacement: path.resolve(lab, "beui/components/app/icons.tsx") },
  { find: "@/components/icons", replacement: path.resolve(lab, "stubs/brand-icons.tsx") },
  { find: "@/components/ui", replacement: path.resolve(lab, "kit") },
  { find: "@/components/kibo-ui", replacement: path.resolve(lab, "kibo") },
  { find: /^next\/navigation$/, replacement: path.resolve(lab, "stubs/next-navigation.ts") },
  { find: /^next\/dynamic$/, replacement: path.resolve(lab, "stubs/next-dynamic.tsx") },
  { find: /^next\/image$/, replacement: path.resolve(lab, "stubs/next-image.tsx") },
  { find: /^next\/link$/, replacement: path.resolve(lab, "stubs/next-link.tsx") },
  { find: /^next-themes$/, replacement: path.resolve(lab, "stubs/next-themes.ts") },
  { find: "@paper-design/shaders-react", replacement: path.resolve(lab, "stubs/shaders-react.tsx") },
  { find: "@codesandbox/sandpack-react", replacement: path.resolve(lab, "stubs/sandpack.tsx") },
  { find: "lenis/react", replacement: path.resolve(lab, "stubs/lenis.ts") },
  { find: "lenis", replacement: path.resolve(lab, "stubs/lenis.ts") },
  { find: "@repo/shadcn-ui/lib/utils", replacement: path.resolve(dir, "../src/cn.ts") },
  { find: "@repo/shadcn-ui/components/ui", replacement: path.resolve(lab, "kit") },
  { find: /^@repo\/(.*)$/, replacement: path.join(lab, "kibo/$1") },
];
