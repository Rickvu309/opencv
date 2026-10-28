// Code commands: build real opencv product screens in a React project.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadKit } from '../kit.js';
import { registry, resolveComponents, resolveScreen, SCREENS, NPM_DEPS, NPM_DEV_DEPS } from './registry.js';
import { DEFAULT_CONFIG, loadConfig, newAppFiles, routesFor, writeApp, writeComponents, writeFiles, writeLogos, writeScreens, writeTheme } from './project.js';
import { lintPaths } from './lint-code.js';
import { themeCss } from './theme.js';

export function makeCodeCommands({ out, fail, c }) {
  const { dim, bold, cyan, green, yellow, red } = c;
  const pad = (s, n) => { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); };
  const report = (rows) => {
    for (const r of rows) out(`  ${r.status === 'skipped' ? dim('skip   ') : green(pad(r.status, 7))} ${r.path}`);
  };
  const needConfig = (cwd) => {
    const cfg = loadConfig(cwd);
    if (!cfg) fail('No opencv.json here. Run `opencv init` in your React project first, or `opencv new <dir>` for a new app.');
    return cfg;
  };
  const npmLine = (deps, dev) => `npm install ${dev ? '-D ' : ''}${Object.entries(deps).map(([k, v]) => `${k}@${v}`).join(' ')}`;

  return {
    new({ args, flags }) {
      const dir = args[0];
      if (!dir) fail('Usage: opencv new <dir> [--install]');
      const cwd = resolve(dir);
      if (existsSync(cwd) && readdirSync(cwd).filter((f) => !f.startsWith('.')).length && !flags.force) fail(`${dir} is not empty. Use --force to write into it.`);
      const cfg = { ...DEFAULT_CONFIG };
      const kit = loadKit();
      const all = resolveScreen(SCREENS.map((s) => s.name));
      out(bold(`Creating ${basename(cwd)}`));
      report([
        ...writeFiles(cwd, newAppFiles(basename(cwd).toLowerCase().replace(/[^a-z0-9-]/g, '-'), cfg), true),
        ...writeTheme(cwd, cfg, kit, true),
        ...writeComponents(cwd, cfg, Object.keys(registry().components), true),
        ...writeApp(cwd, cfg, all.app, true),
        ...writeScreens(cwd, cfg, all.screens, true),
        ...writeLogos(cwd, cfg, true),
      ]);
      if (flags.install) {
        out(dim('\nnpm install...'));
        const r = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd, stdio: 'inherit' });
        if (r.status !== 0) fail('npm install failed.');
      }
      out(`\n${green('Done.')} ${SCREENS.length} screens, ${Object.keys(registry().components).length} component files.\n`);
      out(`  cd ${dir}${flags.install ? '' : '\n  npm install'}\n  npm run dev`);
      out(dim('\nThen open http://localhost:5173/apply. Every route: opencv list screens'));
    },

    init({ flags }) {
      const cwd = process.cwd();
      const existing = loadConfig(cwd);
      const cfg = existing || { ...DEFAULT_CONFIG };
      const rows = [];
      if (!existing) rows.push(...writeFiles(cwd, { 'opencv.json': JSON.stringify(cfg, null, 2) + '\n' }, false));
      rows.push(...writeTheme(cwd, cfg, loadKit(), !!flags.force));
      rows.push(...writeComponents(cwd, cfg, ['cn', 'brand'], !!flags.force));
      report(rows);
      const pkg = existsSync(join(cwd, 'package.json')) ? JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')) : {};
      const has = { ...pkg.dependencies, ...pkg.devDependencies };
      const missing = Object.fromEntries(Object.entries(NPM_DEPS).filter(([k]) => !has[k]));
      const missingDev = Object.fromEntries(Object.entries(NPM_DEV_DEPS).filter(([k]) => ['tailwindcss', '@tailwindcss/vite'].includes(k) && !has[k]));
      out(bold('\nNext'));
      if (Object.keys(missing).length) out(`  ${npmLine(missing)}`);
      if (Object.keys(missingDev).length) out(`  ${npmLine(missingDev, true)}`);
      out(`  Import ${cfg.styles} once in your entry file, and '@fontsource-variable/inter'.`);
      out(`  Add the Tailwind plugin to vite.config: plugins: [react(), tailwindcss()]`);
      out(`  Wrap the app in <ToastProvider> from ${cfg.componentsDir}/feedback.`);
      out(dim('  Then: opencv add Button JobCard   or   opencv screen apply-board'));
    },

    add({ args, flags }) {
      const cwd = process.cwd();
      const cfg = needConfig(cwd);
      const names = flags.all ? Object.keys(registry().components) : args;
      if (!names.length) fail('Usage: opencv add <component...> | --all   (opencv list components)');
      const { files, missing } = resolveComponents(names);
      if (missing.length) fail(`Unknown: ${missing.join(', ')}. Run opencv list components.`);
      report(writeComponents(cwd, cfg, files, !!flags.force));
      if (files.some((f) => f === 'settings')) report(writeLogos(cwd, cfg, false));
    },

    screen({ args, flags }) {
      const cwd = process.cwd();
      const cfg = needConfig(cwd);
      if (!args.length) fail(`Usage: opencv screen <name...>  Screens: ${SCREENS.map((s) => s.name).join(', ')}`);
      const r = resolveScreen(args);
      if (r.missing.length) fail(`Unknown screen: ${r.missing.join(', ')}. Run opencv list screens.`);
      report([
        ...writeComponents(cwd, cfg, r.components, !!flags.force),
        ...writeApp(cwd, cfg, r.app, false),
        ...writeScreens(cwd, cfg, r.screens, !!flags.force),
        ...(r.components.includes('settings') ? writeLogos(cwd, cfg, false) : []),
      ]);
      const { imports, routes } = routesFor(args, cfg);
      out(bold('\nAdd the routes') + dim(' (react-router, inside <Routes>; wrap the app in <ToastProvider>)'));
      out(imports);
      out(routes.replace(/^ {8}/gm, ''));
    },

    list({ args, flags }) {
      const what = args[0] || 'all';
      const reg = registry();
      if (flags.json) return out(JSON.stringify({
        components: Object.values(reg.components).map(({ name, exports, deps, desc }) => ({ name, exports, deps, desc })),
        screens: Object.values(reg.screens).map(({ name, title, route, desc, comps }) => ({ name, title, route, desc, components: comps })),
      }, null, 2));
      if (what === 'all' || what === 'components') {
        out(bold('Components') + dim('  (opencv add <file or export name>)'));
        for (const c2 of Object.values(reg.components)) {
          if (c2.name === 'cn') continue;
          out(`  ${cyan(pad(c2.name, 10))} ${c2.desc}`);
        }
      }
      if (what === 'all' || what === 'screens') {
        out('\n' + bold('Screens') + dim('  (opencv screen <name>)'));
        for (const s of Object.values(reg.screens)) out(`  ${cyan(pad(s.name, 15))} ${dim(pad(s.route, 22))}${s.desc}`);
      }
    },

    show({ args, flags }) {
      const reg = registry();
      const n = args[0]?.toLowerCase();
      const comp = reg.components[n] || Object.values(reg.components).find((x) => x.exports.some((e) => e.toLowerCase() === n));
      const scr = reg.screens[n];
      if (!comp && !scr) fail(`No component or screen "${args[0]}". Run opencv list.`);
      if (flags.json) return out(JSON.stringify(comp || scr, null, 2));
      if (flags.source) return out((comp || scr).src);
      if (comp) {
        out(`${bold(comp.name + '.tsx')}  ${comp.desc}`);
        out(dim('exports: ') + comp.exports.join(', '));
        if (comp.deps.length) out(dim('uses:    ') + comp.deps.join(', '));
        out(dim('npm:     ') + comp.npm.join(', '));
        const docs = [...comp.src.matchAll(/\/\*\* ([^*]+?) \*\/\s*export (?:const|function) (\w+)/g)];
        if (docs.length) { out(''); for (const d of docs) out(`  ${cyan(pad(d[2], 16))} ${d[1].trim()}`); }
        out(dim(`\nopencv show ${comp.name} --source   prints the code`));
      } else {
        out(`${bold(scr.title)}  ${dim(scr.route)}\n${scr.desc}`);
        out(dim('components: ') + resolveScreen([scr.name]).components.join(', '));
        out(dim(`\nopencv screen ${scr.name}   adds it to your project`));
      }
    },

    lint({ args, flags }) {
      const cwd = process.cwd();
      const cfg = loadConfig(cwd);
      const paths = (args.length ? args : [cfg?.srcDir || 'src']).map((p) => resolve(p));
      for (const p of paths) if (!existsSync(p)) fail(`Not found: ${p}`);
      const all = lintPaths(paths, loadKit(), cwd);
      const shown = flags.verbose ? all : all.filter((f) => f.level !== 'info');
      if (flags.json) out(JSON.stringify(shown, null, 2));
      else {
        for (const f of shown) {
          const tag = f.level === 'error' ? red('error  ') : f.level === 'warning' ? yellow('warning') : dim('info   ');
          out(`${tag} ${cyan(pad(f.rule, 15))} ${dim(`${f.file}:${f.line}`)}  ${f.message}`);
        }
        const e = all.filter((f) => f.level === 'error').length, w = all.filter((f) => f.level === 'warning').length;
        out((e ? red : w ? yellow : green)(`\n${e} errors, ${w} warnings`) + dim(`, ${all.length - e - w} hints${flags.verbose ? '' : ' (--verbose to show)'}`));
      }
      if (all.some((f) => f.level === 'error')) process.exitCode = 1;
    },

    theme() { out(themeCss(loadKit())); },

    doctor() {
      const cwd = process.cwd();
      const cfg = loadConfig(cwd);
      const checks = [];
      const ok = (cond, label, fix) => checks.push({ cond, label, fix });
      ok(!!cfg, 'opencv.json', 'opencv init');
      const pkgPath = join(cwd, 'package.json');
      const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : {};
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const d of ['react', 'react-router', 'lucide-react', 'tailwindcss', '@tailwindcss/vite']) ok(!!deps[d], `dependency ${d}`, `npm install ${d}`);
      if (cfg) {
        ok(existsSync(resolve(cwd, cfg.styles)), cfg.styles, 'opencv init');
        ok(existsSync(resolve(cwd, cfg.componentsDir, 'cn.ts')), `${cfg.componentsDir}/cn.ts`, 'opencv add cn');
        const entry = ['main.tsx', 'main.ts', 'index.tsx'].map((f) => resolve(cwd, cfg.srcDir, f)).find(existsSync);
        const entrySrc = entry ? readFileSync(entry, 'utf8') : '';
        ok(/opencv\.css/.test(entrySrc), 'entry imports opencv.css', `import './styles/opencv.css' in ${cfg.srcDir}/main.tsx`);
        ok(/ToastProvider/.test(entrySrc), 'app wrapped in <ToastProvider>', 'wrap your routes in <ToastProvider>');
      }
      const vite = ['vite.config.ts', 'vite.config.js', 'vite.config.mts'].map((f) => join(cwd, f)).find(existsSync);
      ok(!!vite && /tailwindcss\(/.test(readFileSync(vite, 'utf8')), 'Tailwind vite plugin', "plugins: [react(), tailwindcss()] in vite.config");
      for (const ch of checks) out(`${ch.cond ? green('ok  ') : red('fix ')} ${ch.label}${ch.cond ? '' : dim('  -> ' + ch.fix)}`);
      if (checks.some((ch) => !ch.cond)) process.exitCode = 1;
    },
  };
}
