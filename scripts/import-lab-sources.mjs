#!/usr/bin/env node
/**
 * Pull free sourced galleries into packages/opath-ui/src/lab.
 * Run from repo root: node scripts/import-lab-sources.mjs
 */
import { execSync } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  cpSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = path.join(root, ".cache", "lab-sources");
const lab = path.join(root, "packages/opath-ui/src/lab");

const BEUI_MOTION = [
  "tilt-card",
  "button",
  "expanding-arrow-button",
  "marquee",
  "tabs",
  "switch",
  "input",
  "select",
  "combobox",
  "checkbox",
  "radio",
  "bottom-sheet",
  "pull-to-refresh",
  "shared-layout-bg",
  "bounce-sidebar",
  "animated-sidebar",
  "preview-rail",
  "dock",
  "tooltip",
  "context-menu",
  "popover",
  "morphing-modal",
  "center-morph-modal",
  "text-animation",
  "number",
  "animated-badge",
  "action-swap",
  "animated-toast-stack",
  "theme-toggle",
  "bouncy-accordion",
  "drawer",
  "scroll-animation",
  "range-slider",
  "wheel-picker",
  "table",
  "shader-background",
  "cylinder-carousel",
  "loader",
];

function sh(cmd, cwd = root) {
  execSync(cmd, { cwd, stdio: "inherit" });
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function clone(url, dest) {
  if (existsSync(path.join(dest, ".git"))) {
    console.log(`cached ${dest}`);
    return;
  }
  ensureDir(path.dirname(dest));
  sh(`git clone --depth 1 ${url} ${dest}`);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function rewriteSource(src) {
  return src
    .replaceAll("@repo/shadcn-ui/lib/utils", "@/lib/utils")
    .replaceAll("@repo/shadcn-ui/components/ui/", "@/components/ui/")
    .replaceAll("@/hooks/", "@/lab-hooks/")
    .replaceAll(/\bbg-accent\b/g, "bg-surface-2")
    .replaceAll(/\btext-accent-foreground\b/g, "text-ink")
    .replaceAll(/\bhover:bg-accent\b/g, "hover:bg-surface-2");
}

function titleFromSlug(slug) {
  return slug
    .split(/[-_/]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function writeStory({ gallery, slug, importPath, exportName, jsx }) {
  const dir = path.join(lab, gallery);
  ensureDir(dir);
  const file = path.join(dir, `${slug}.stories.tsx`);
  const source = `import type { Meta, StoryObj } from "@storybook/react-vite";
import { ${exportName} } from "${importPath}";
import { StoryFrame } from "../story-frame";

const meta = {
  title: "Lab/${titleFromSlug(gallery)}/${titleFromSlug(slug)}",
} satisfies Meta;
export default meta;

type Story = StoryObj;

export const Demo: Story = {
  render: () => (
    <StoryFrame>
      ${jsx}
    </StoryFrame>
  ),
};
`;
  writeFileSync(file, source);
}

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

async function importTransitions() {
  const dest = path.join(lab, "transitions");
  ensureDir(dest);
  const skill = "https://raw.githubusercontent.com/Jakubantalik/transitions.dev/main/skills/transitions-dev";
  const rootCss = await fetchText(`${skill}/_root.css`);
  writeFileSync(path.join(dest, "root.css"), rootCss);

  const list = await fetchText(`${skill}/SKILL.md`);
  const files = [...list.matchAll(/\[(\d{2}-[a-z0-9-]+\.md)\]/g)].map((m) => m[1]);
  const unique = [...new Set(files)];
  const names = [];

  for (const file of unique) {
    const md = await fetchText(`${skill}/${file}`);
    const cssMatch = md.match(/```css\n([\s\S]*?)```/);
    const htmlMatch = md.match(/```html\n([\s\S]*?)```/);
    const slug = file.replace(/^\d+-/, "").replace(/\.md$/, "");
    const css = cssMatch?.[1] ?? "";
    writeFileSync(path.join(dest, `${slug}.css`), css);

    const html = (htmlMatch?.[1] ?? `<button type="button" class="t-demo">Play ${titleFromSlug(slug)}</button>`)
      .replace(/`/g, "\\`")
      .trim();

    const component = `export function ${exportNameFromSlug(slug)}() {
  return (
    <div data-transition="${slug}" className="lab-transition" dangerouslySetInnerHTML={{ __html: \`${html}\` }} />
  );
}
`;
    writeFileSync(path.join(dest, `${slug}.tsx`), `import "./root.css";
import "./${slug}.css";

${component}`);
    names.push(slug);
  }

  const stories = `import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";
${names.map((slug) => `import { ${exportNameFromSlug(slug)} } from "./${slug}";`).join("\n")}

const meta = { title: "Lab/Transitions" } satisfies Meta;
export default meta;
type Story = StoryObj;

${names
  .map(
    (slug) => `export const ${exportNameFromSlug(slug)}: Story = {
  name: "${titleFromSlug(slug)}",
  render: () => (
    <StoryFrame width={480}>
      <${exportNameFromSlug(slug)} />
    </StoryFrame>
  ),
};`,
  )
  .join("\n\n")}
`;
  writeFileSync(path.join(dest, "transitions.stories.tsx"), stories);
  console.log(`transitions: ${names.length}`);
}

function exportNameFromSlug(slug) {
  return slug
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

async function importBeui() {
  const dest = path.join(lab, "beui");
  ensureDir(dest);
  const written = new Map();
  const previews = [];

  for (const slug of BEUI_MOTION) {
    console.log(`beui ${slug}`);
    const json = await fetchJson(`https://beui.dev/r/${slug}`);
    for (const file of json.files ?? []) {
      if (!file.content || !file.path) continue;
      const rel = file.path
        .replace(/^components\/motion\//, "motion/")
        .replace(/^components\/previews\/motion\//, "previews/")
        .replace(/^lib\//, "lib/");
      const target = path.join(dest, rel);
      if (written.has(target)) continue;
      ensureDir(path.dirname(target));
      const fromDir = path.posix.dirname(rel);
      const toUtils = path.posix.relative(fromDir, "lib/utils") || "./utils";
      const toEase = path.posix.relative(fromDir, "lib/ease") || "./ease";
      const toHooks = path.posix.relative(fromDir, "lib/hooks") || "./hooks";
      const toMotion = path.posix.relative(fromDir, "motion") || ".";
      let content = file.content
        .replaceAll("@/lib/utils", toUtils.startsWith(".") ? toUtils : `./${toUtils}`)
        .replaceAll("@/lib/ease", toEase.startsWith(".") ? toEase : `./${toEase}`)
        .replaceAll("@/lib/hooks/", `${toHooks.startsWith(".") ? toHooks : `./${toHooks}`}/`)
        .replaceAll("@/components/motion/", `${toMotion.startsWith(".") ? toMotion : `./${toMotion}`}/`);
      writeFileSync(target, rewriteSource(content));
      written.set(target, true);
    }
    previews.push(slug);
  }

  const stories = `import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";
${previews
  .map((slug) => {
    const name = exportNameFromSlug(slug);
    return `import { ${name}Preview } from "./previews/${slug}.preview";`.replace(
      `{ ${name}Preview }`,
      `{ ${guessPreviewExport(slug)} as ${name}Preview }`,
    );
  })
  .join("\n")}

const meta = { title: "Lab/beUI" } satisfies Meta;
export default meta;
type Story = StoryObj;

${previews
  .map((slug) => {
    const name = exportNameFromSlug(slug);
    return `export const ${name}: Story = {
  render: () => (
    <StoryFrame width={560}>
      <${name}Preview />
    </StoryFrame>
  ),
};`;
  })
  .join("\n\n")}
`;
  writeFileSync(path.join(dest, "beui.stories.tsx"), stories);
  console.log(`beui: ${previews.length}`);
}

function guessPreviewExport(slug) {
  return `${exportNameFromSlug(slug)}Preview`;
}

async function importKiboFromRegistry() {
  const dest = path.join(lab, "kibo");
  ensureDir(dest);
  const data = await fetchJson("https://www.kibo-ui.com/r/registry.json");
  const names = [];
  for (const item of data.items ?? []) {
    if (!item.name) continue;
    const dir = path.join(dest, item.name);
    ensureDir(dir);
    for (const file of item.files ?? []) {
      if (!file.content) continue;
      const filename = path.basename(file.path || "index.tsx");
      writeFileSync(path.join(dir, filename), rewriteSource(file.content));
    }
    names.push(item.name);
  }

  const examplesSrc = path.join(cache, "kibo", "apps/docs/examples");
  const exampleStories = [];
  if (existsSync(examplesSrc)) {
    const examplesDest = path.join(dest, "_examples");
    ensureDir(examplesDest);
    for (const file of readdirSync(examplesSrc).filter((f) => f.endsWith(".tsx"))) {
      const src = rewriteSource(readFileSync(path.join(examplesSrc, file), "utf8"))
        .replaceAll("@/components/kibo-ui/", "../")
        .replaceAll("from \"@/components/kibo-ui/", "from \"../");
      writeFileSync(path.join(examplesDest, file), src);
      const slug = file.replace(/\.tsx$/, "");
      exampleStories.push(slug);
    }
  }

  const stories = `import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";

const meta = { title: "Lab/Kibo" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const Catalog: Story = {
  render: () => (
    <StoryFrame width={640}>
      <ul className="grid gap-2 text-[13px] text-ink">
        ${names.map((name) => `<li key="${name}">${name}</li>`).join("\n        ")}
      </ul>
    </StoryFrame>
  ),
};
`;
  writeFileSync(path.join(dest, "kibo.stories.tsx"), stories);

  if (exampleStories.length) {
    const per = `import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../../story-frame";
${exampleStories
  .map((slug) => `import Example_${exportNameFromSlug(slug)} from "./${slug}";`)
  .join("\n")}

const meta = { title: "Lab/Kibo/Examples" } satisfies Meta;
export default meta;
type Story = StoryObj;

${exampleStories
  .map(
    (slug) => `export const ${exportNameFromSlug(slug)}: Story = {
  render: () => (
    <StoryFrame width={720}>
      <Example_${exportNameFromSlug(slug)} />
    </StoryFrame>
  ),
};`,
  )
  .join("\n\n")}
`;
    writeFileSync(path.join(dest, "_examples/examples.stories.tsx"), per);
  }
  console.log(`kibo: ${names.length} components, ${exampleStories.length} examples`);
}

async function importBlocksFromRegistry() {
  const dest = path.join(lab, "blocks-so");
  ensureDir(dest);
  const data = await fetchJson("https://blocks.so/r/registry.json");
  const names = [];
  for (const item of data.items ?? []) {
    if (!item.name || item.type === "registry:style") continue;
    const dir = path.join(dest, item.name);
    ensureDir(dir);
    for (const file of item.files ?? []) {
      if (!file.content) continue;
      const filename = path.basename(file.target || file.path || "index.tsx");
      const content = rewriteSource(file.content)
        .replaceAll("@/components/ui/", "../../kit/")
        .replaceAll("@/lib/utils", "../../cn")
        .replaceAll("@/components/", "../");
      writeFileSync(path.join(dir, filename), content);
    }
    names.push(item.name);
  }

  const stories = `import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";
${names
  .map((name) => {
    const exp = exportNameFromSlug(name);
    return `import ${exp} from "./${name}/${name}";`;
  })
  .join("\n")}

const meta = { title: "Lab/Blocks" } satisfies Meta;
export default meta;
type Story = StoryObj;

${names
  .map((name) => {
    const exp = exportNameFromSlug(name);
    return `export const ${exp}Story: Story = {
  name: "${name}",
  render: () => (
    <StoryFrame width={720}>
      <${exp} />
    </StoryFrame>
  ),
};`;
  })
  .join("\n\n")}
`;
  writeFileSync(path.join(dest, "blocks.stories.tsx"), stories);
  console.log(`blocks.so: ${names.length}`);
}

function importEightstar() {
  const src = path.join(cache, "8starlabs-ui", "registry", "8starlabs-ui");
  const dest = path.join(lab, "eightstar");
  if (!existsSync(src)) {
    console.warn("8starlabs clone missing");
    return;
  }
  cpSync(src, dest, { recursive: true });
  for (const file of walkFiles(dest)) {
    if (!/\.(tsx|ts|css)$/.test(file)) continue;
    const next = rewriteSource(readFileSync(file, "utf8"))
      .replaceAll("@/lib/utils", "../../cn")
      .replaceAll("@/registry/8starlabs-ui/", "../")
      .replaceAll("@/components/8starlabs-ui/", "../");
    writeFileSync(file, next);
  }

  const blocks = existsSync(path.join(dest, "blocks"))
    ? readdirSync(path.join(dest, "blocks")).filter((f) => f.endsWith(".tsx"))
    : [];
  const ui = existsSync(path.join(dest, "ui"))
    ? readdirSync(path.join(dest, "ui")).filter((f) => f.endsWith(".tsx"))
    : [];
  const examples = existsSync(path.join(dest, "examples"))
    ? readdirSync(path.join(dest, "examples")).filter((f) => f.endsWith(".tsx"))
    : [];

  const stories = `import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";
${examples
  .map((file) => {
    const slug = file.replace(/\.tsx$/, "");
    return `import ${exportNameFromSlug(slug)} from "./examples/${slug}";`;
  })
  .join("\n")}

const meta = { title: "Lab/8StarLabs" } satisfies Meta;
export default meta;
type Story = StoryObj;

${examples
  .map((file) => {
    const slug = file.replace(/\.tsx$/, "");
    const exp = exportNameFromSlug(slug);
    return `export const ${exp}Story: Story = {
  name: "${slug}",
  render: () => (
    <StoryFrame width={640}>
      <${exp} />
    </StoryFrame>
  ),
};`;
  })
  .join("\n\n")}
`;
  writeFileSync(path.join(dest, "eightstar.stories.tsx"), stories);
  console.log(`8starlabs: ui ${ui.length}, blocks ${blocks.length}, examples ${examples.length}`);
}

function importKit() {
  const src = path.join(cache, "blocks-so", "components", "ui");
  const dest = path.join(lab, "kit");
  if (!existsSync(src)) {
    console.warn("blocks.so ui kit missing");
    return;
  }
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
  for (const file of walkFiles(dest)) {
    if (!/\.(tsx|ts)$/.test(file)) continue;
    const next = rewriteSource(readFileSync(file, "utf8"))
      .replaceAll("@/lib/utils", "../../cn")
      .replaceAll("@/components/ui/", "./");
    writeFileSync(file, next);
  }
  const hooksSrc = path.join(cache, "blocks-so", "hooks");
  const hooksDest = path.join(lab, "hooks");
  if (existsSync(hooksSrc)) {
    if (existsSync(hooksDest)) rmSync(hooksDest, { recursive: true, force: true });
    cpSync(hooksSrc, hooksDest, { recursive: true });
    for (const file of walkFiles(hooksDest)) {
      if (!/\.(tsx|ts)$/.test(file)) continue;
      const next = rewriteSource(readFileSync(file, "utf8")).replaceAll(
        "@/lib/utils",
        "../../cn",
      );
      writeFileSync(file, next);
    }
  }
  console.log("kit copied");
}

async function main() {
  ensureDir(cache);
  clone("https://github.com/ephraimduncan/blocks.git", path.join(cache, "blocks-so"));
  clone("https://github.com/8starlabs/ui.git", path.join(cache, "8starlabs-ui"));
  clone("https://github.com/shadcnblocks/kibo.git", path.join(cache, "kibo"));

  importKit();
  importEightstar();
  await importKiboFromRegistry();
  await importBlocksFromRegistry();
  await importTransitions();
  await importBeui();
  const { spawnSync } = await import("node:child_process");
  spawnSync("python3", [path.join(root, "scripts/build-lab-catalog.py")], { stdio: "inherit" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
