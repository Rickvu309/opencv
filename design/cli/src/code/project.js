// Writes registry files into a React project: config, import rewriting, new-app template.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
} from "node:fs"
import { join, relative, dirname, resolve, basename } from "node:path"
import {
  REGISTRY,
  NPM_DEPS,
  NPM_DEV_DEPS,
  SCREENS,
  registry,
} from "./registry.js"
import { themeCss } from "./theme.js"

export const DEFAULT_CONFIG = {
  srcDir: "src",
  componentsDir: "src/components/opencv",
  screensDir: "src/screens",
  appDir: "src/app",
  styles: "src/styles/opencv.css",
  publicDir: "public",
}

export function loadConfig(cwd) {
  const p = join(cwd, "opencv.json")
  return existsSync(p)
    ? { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(p, "utf8")) }
    : null
}

function rel(fromDir, toDir) {
  let r = relative(fromDir, toDir).split("\\").join("/")
  if (!r) return "."
  return r.startsWith(".") ? r : `./${r}`
}

function prepareSource(src, fileDir, cwd, cfg, transform) {
  if (cfg.target === "shadcn") {
    const app = rel(fileDir, resolve(cwd, cfg.appDir || DEFAULT_CONFIG.appDir))
    const withApp = src.replace(/(['"])~app\/([\w-]+)\1/g, `$1${app}/$2$1`)
    return transform(withApp)
  }
  return transform(rewriteImports(src, fileDir, cwd, cfg))
}

/** Rewrites ~components/ and ~app/ placeholders to relative paths for where the file lands. */
export function rewriteImports(src, fileDir, cwd, cfg) {
  const comps = rel(fileDir, resolve(cwd, cfg.componentsDir))
  const app = rel(fileDir, resolve(cwd, cfg.appDir))
  return src
    .replace(/(['"])~components\/([\w-]+)\1/g, `$1${comps}/$2$1`)
    .replace(/(['"])~app\/([\w-]+)\1/g, `$1${app}/$2$1`)
}

/** Writes a file unless it exists and force is off. Returns 'created' | 'updated' | 'skipped'. */
function put(path, content, force) {
  const exists = existsSync(path)
  if (exists && !force) return "skipped"
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
  return exists ? "updated" : "created"
}

export function writeComponents(
  cwd,
  cfg,
  names,
  force,
  transform = (src) => src
) {
  const { components } = registry()
  const dir = resolve(cwd, cfg.componentsDir)
  return names.map((n) => ({
    path: join(cfg.componentsDir, components[n].file),
    status: put(
      join(dir, components[n].file),
      transform(components[n].src),
      force
    ),
  }))
}

export function writeApp(cwd, cfg, names, force, transform = (src) => src) {
  const { app } = registry()
  const dir = resolve(cwd, cfg.appDir)
  return names.map((n) => ({
    path: join(cfg.appDir, app[n].file),
    status: put(
      join(dir, app[n].file),
      prepareSource(app[n].src, dir, cwd, cfg, transform),
      force
    ),
  }))
}

export function writeScreens(cwd, cfg, names, force, transform = (src) => src) {
  const { screens } = registry()
  const dir = resolve(cwd, cfg.screensDir)
  return names.map((n) => ({
    path: join(cfg.screensDir, screens[n].file),
    status: put(
      join(dir, screens[n].file),
      prepareSource(screens[n].src, dir, cwd, cfg, transform),
      force
    ),
  }))
}

export function writeTheme(cwd, cfg, kit, force) {
  return [
    {
      path: cfg.styles,
      status: put(resolve(cwd, cfg.styles), themeCss(kit), force),
    },
  ]
}

export function writeLogos(cwd, cfg, force) {
  const src = join(REGISTRY, "public", "logos")
  const dir = resolve(cwd, cfg.publicDir, "logos")
  mkdirSync(dir, { recursive: true })
  let n = 0
  for (const f of readdirSync(src)) {
    const to = join(dir, f)
    if (!existsSync(to) || force) {
      copyFileSync(join(src, f), to)
      n++
    }
  }
  return [
    {
      path: join(cfg.publicDir, "logos/"),
      status: n ? `${n} files` : "skipped",
    },
  ]
}

export function routesFor(names, cfg) {
  const { screens } = registry()
  const list = names.map((n) => screens[n])
  const id = (n) =>
    n
      .split("-")
      .map((p) => p[0].toUpperCase() + p.slice(1))
      .join("")
  const screensImport = rel(resolve(cfg.srcDir), resolve(cfg.screensDir))
  return {
    imports: list
      .map((s) => `import ${id(s.name)} from '${screensImport}/${s.name}';`)
      .join("\n"),
    routes: list
      .map(
        (s) => `        <Route path="${s.route}" element={<${id(s.name)} />} />`
      )
      .join("\n"),
  }
}

export function newAppFiles(name, cfg) {
  const { imports, routes } = routesFor(
    SCREENS.map((s) => s.name),
    cfg
  )
  const comps = rel(resolve(cfg.srcDir), resolve(cfg.componentsDir))
  const styles =
    rel(resolve(cfg.srcDir), resolve(dirname(cfg.styles))) +
    "/" +
    basename(cfg.styles)
  return {
    "package.json":
      JSON.stringify(
        {
          name,
          private: true,
          version: "0.1.0",
          type: "module",
          scripts: {
            dev: "vite",
            build: "tsc -b && vite build",
            preview: "vite preview",
            lint: "opencv lint",
          },
          dependencies: NPM_DEPS,
          devDependencies: NPM_DEV_DEPS,
        },
        null,
        2
      ) + "\n",
    "vite.config.ts": `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
`,
    "tsconfig.json":
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            lib: ["ES2022", "DOM", "DOM.Iterable"],
            module: "ESNext",
            moduleResolution: "bundler",
            jsx: "react-jsx",
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            isolatedModules: true,
            allowImportingTsExtensions: false,
            noUnusedLocals: true,
            noUnusedParameters: true,
            types: ["vite/client"],
          },
          include: ["src"],
        },
        null,
        2
      ) + "\n",
    "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>opencv</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/${cfg.srcDir}/main.tsx"></script>
  </body>
</html>
`,
    [`${cfg.srcDir}/main.tsx`]: `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import '@fontsource-variable/inter';
import '${styles}';
import { ToastProvider } from '${comps}/feedback';
${imports}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/apply" replace />} />
${routes}
          <Route path="*" element={<Navigate to="/apply" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  </StrictMode>,
);
`,
    ".gitignore": "node_modules\ndist\n",
    "opencv.json": JSON.stringify(cfg, null, 2) + "\n",
  }
}

export function writeFiles(cwd, files, force) {
  return Object.entries(files).map(([p, content]) => ({
    path: p,
    status: put(resolve(cwd, p), content, force),
  }))
}
