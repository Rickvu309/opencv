import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadKit, loadRules, findComponent, searchComponents, resolveVariant, allVariants } from './kit.js';
import { instanceSnippet, glowSnippet, brandSnippet, meshFill } from './snippet.js';
import { screenSnippet, SCREEN_LAYOUTS } from './screen.js';
import { lintTree, lintText, parseDump } from './lint.js';
import { tokensCss, tailwindPreset, tokensW3c, componentsManifest } from './export.js';
import { buildKit, parseSyncOutput, SYNC_SNIPPET } from './build.js';
import { GUIDE, PEN_GUIDE } from './guide.js';
import { makeCodeCommands } from './code/commands.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const dim = c(2), bold = c(1), red = c(31), yellow = c(33), cyan = c(36), green = c(32);

const HELP = `${bold('opencv')} ${dim('v' + pkg.version)}  build real opencv product screens in React, on the design system

${bold('Start')}
  guide                         agent playbook (start here)
  new <dir> [--install]         a new Vite + React + Tailwind app with every opencv screen
  init [--force]                add opencv to an existing React project (theme, config)
  doctor                        check the project setup

${bold('Build')}
  list [components|screens]     what you can add
  show <name> [--source]        a component file or screen: exports, props, code
  add <names...> | --all        copy components into your project (Button, JobCard, apply...)
  screen <names...>             copy full screens with everything they use, print the routes
  theme                         print opencv.css (Tailwind v4 theme from the kit tokens)

${bold('Check')}
  lint [paths...]               opencv rules on your code: brand, copy, orange, black buttons, warm tints
  copy <text>                   writing rules on one string
  rules [topic]                 design decisions: brand color buttons copy layout apply coach plans process

${bold('Ship')}
  tokens [group]                design tokens (ds, stage, l, label)
  export <dir>                  tokens.css, Tailwind preset, tokens.json, components.json
  skill [--install [dir]]       print or install the Claude skills (opencv-build, opencv-pen)
  pen <command>                 pen.dev canvas tools: ls show find layouts screens screen snippet glow brand lint sync

${dim('Global: --json for machine output, --force to overwrite, --help, --version')}
`;

function out(s) { process.stdout.write(s.endsWith('\n') ? s : s + '\n'); }
function fail(msg, code = 1) { process.stderr.write(red('error') + ' ' + msg + '\n'); process.exit(code); }
function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }

function kv(list) {
  const o = {};
  for (const item of list || []) {
    const i = item.indexOf('=');
    if (i < 1) fail(`Expected Name=Value, got "${item}"`);
    o[item.slice(0, i).trim()] = item.slice(i + 1);
  }
  return o;
}

function readInput(file) {
  if (!file || file === '-') return readFileSync(0, 'utf8');
  if (!existsSync(file)) fail(`File not found: ${file}`);
  return readFileSync(file, 'utf8');
}

const SHARED = {
  guide() { out(GUIDE); },

  rules({ args, flags }) {
    const rules = loadRules();
    const topics = args.length ? args : Object.keys(rules);
    if (flags.json) return out(JSON.stringify(Object.fromEntries(topics.map((t) => [t, rules[t]])), null, 2));
    for (const t of topics) {
      const r = rules[t];
      if (!r) fail(`Unknown topic "${t}". Topics: ${Object.keys(rules).join(', ')}`);
      out(bold(r.title));
      for (const line of r.rules) out(`  - ${line}`);
      out('');
    }
  },

  ls({ args, flags }) {
    const kit = loadKit();
    let list = searchComponents(kit, args.join(' '));
    if (flags.kind) list = list.filter((x) => x.kind === flags.kind);
    if (flags.json) return out(JSON.stringify(list.map(({ key, name, kind, desc, variants }) => ({ key, name, kind, desc, variants: variants.length })), null, 2));
    let kind = '';
    for (const x of list) {
      if (x.kind !== kind) { kind = x.kind; out('\n' + bold(kind + 's')); }
      out(`  ${cyan(pad(x.key, 36))}${dim(pad(x.variants.length ? x.variants.length + ' masters' : 'spec', 12))}${x.desc.slice(0, 80)}`);
    }
    out(dim(`\n${list.length} entries. opencv show <key> for details.`));
  },

  show({ args, flags }) {
    if (!args.length) fail('Usage: opencv show <component>');
    const kit = loadKit();
    const comp = findComponent(kit, args.join(' '));
    if (!comp) {
      const hits = searchComponents(kit, args.join(' ')).map((x) => x.key);
      fail(`No component "${args.join(' ')}".${hits.length ? ' Did you mean: ' + hits.slice(0, 6).join(', ') : ''}`);
    }
    if (flags.json) return out(JSON.stringify(comp, null, 2));
    out(`${bold(comp.name)} ${dim(comp.kind + ' on board ' + comp.board)}`);
    if (comp.desc) out(comp.desc);
    for (const [k, v] of Object.entries(comp.spec)) {
      out('\n' + bold(k));
      for (const line of String(v).split('\n')) out('  ' + line);
    }
    if (comp.variants.length) {
      out('\n' + bold('Masters'));
      for (const v of comp.variants) {
        const slots = v.texts.map((t) => t.name || t.content).filter(Boolean).slice(0, 3).join(', ');
        out(`  ${cyan(pad(v.id, 8))} ${pad(v.name, 40)}${dim(slots)}`);
      }
      out(dim(`\nInsert one: opencv snippet ${comp.variants[0].parts.map((p) => p.toLowerCase()).join(' ')}`));
    }
    if (comp.seeAlso?.length) out(dim(`\nMasters live in: ${comp.seeAlso.join(', ')}`));
  },

  find({ args, flags }) {
    const kit = loadKit();
    const { variant, candidates } = resolveVariant(kit, args);
    if (!variant) fail(`No master matches "${args.join(' ')}". Try opencv ls.`);
    if (flags.json) return out(JSON.stringify({ match: variant, candidates }, null, 2));
    out(`${green(variant.id)}  ${bold(variant.name)}  ${dim(variant.component)}`);
    if (variant.texts.length) out(dim('  texts: ') + variant.texts.map((t) => `${t.name || '?'}="${t.content}"`).join('  '));
    if (variant.icons.length) out(dim('  icons: ') + variant.icons.map((i) => `${i.name}=${i.icon}`).join('  '));
    const others = candidates.filter((x) => x.id !== variant.id).slice(0, 5);
    if (others.length) out(dim('  also: ' + others.map((x) => `${x.name} (${x.id})`).join(', ')));
  },

  layouts({ flags }) {
    const kit = loadKit();
    if (flags.json) return out(JSON.stringify(kit.layouts, null, 2));
    for (const [k, l] of Object.entries(kit.layouts)) {
      out(`  ${cyan(pad(k, 10))}${bold(pad(l.name, 24))}${l.use}`);
      out(`  ${pad('', 10)}${dim(l.regions + '; header: ' + l.header)}`);
    }
    out(dim('\nScaffold one: opencv screen <layout> --name "W13.1 Title"'));
  },

  screens({ args, flags }) {
    const kit = loadKit();
    const qs = args.join(' ').toLowerCase();
    const list = kit.screens.filter((s) => !qs || s.name.toLowerCase().includes(qs));
    if (flags.json) return out(JSON.stringify(list, null, 2));
    for (const s of list) out(`  ${cyan(pad(s.id, 8))} ${s.name}${s.ref ? dim('  (instance of ' + s.ref + ')') : ''}`);
    out(dim(`\n${list.length} screens. Export one to PNG to see it, or Copy it as a starting point.`));
  },

  tokens({ args, flags }) {
    const kit = loadKit();
    const group = args[0];
    const entries = Object.entries(kit.tokens).filter(([k]) => !group || k.startsWith(group + '-') || (group === 'stage' && k.startsWith('ds-stage')));
    if (flags.json) return out(JSON.stringify(Object.fromEntries(entries), null, 2));
    if (flags.format === 'css') return out(tokensCss({ ...kit, tokens: Object.fromEntries(entries) }));
    for (const [k, t] of entries) {
      const v = typeof t.value === 'object' ? JSON.stringify(t.value) : t.value;
      const swatch = tty && t.type === 'color' && /^#[0-9A-F]{6}/i.test(v) ? `\x1b[48;2;${parseInt(v.slice(1, 3), 16)};${parseInt(v.slice(3, 5), 16)};${parseInt(v.slice(5, 7), 16)}m  \x1b[0m ` : '';
      out(`  ${swatch}${pad('$' + k, 26)}${dim(pad(t.type, 8))}${v}`);
    }
  },

  glow({ args, flags }) {
    const kit = loadKit();
    const name = args[0];
    if (!name) {
      for (const [k, g] of Object.entries(kit.glow)) out(`  ${cyan(pad(k, 8))}${g.use}`);
      return out(dim('\nopencv glow <name> prints the fill; add --snippet for a ready frame.'));
    }
    const g = kit.glow[name];
    if (!g) fail(`Unknown glow "${name}". Use: ${Object.keys(kit.glow).join(', ')}`);
    if (flags.snippet) return out(glowSnippet(name, g, flags));
    out(JSON.stringify(meshFill(g), null, flags.json ? 2 : 0));
  },

  brand({ flags }) { out(brandSnippet(flags)); },

  snippet({ args, flags }) {
    if (!args.length) fail('Usage: opencv snippet <words...> [--label text] [--parent id]');
    const kit = loadKit();
    const { variant, candidates } = resolveVariant(kit, args);
    if (!variant) fail(`No master matches "${args.join(' ')}". Try opencv ls or opencv find.`);
    const texts = kv(flags.text);
    if (flags.label != null) {
      const first = variant.texts[0];
      if (!first) fail(`${variant.name} has no text to label.`);
      texts[first.name || '1'] = flags.label;
    }
    try {
      out(instanceSnippet(variant, { ...flags, texts, icons: kv(flags.icon) }));
    } catch (e) { fail(e.message); }
    if (process.stderr.isTTY) {
      const others = candidates.filter((x) => x.id !== variant.id).slice(0, 3).map((x) => x.name);
      process.stderr.write(dim(`matched ${variant.name}${others.length ? ' (others: ' + others.join(', ') + ')' : ''}\n`));
    }
  },

  screen({ args, flags }) {
    if (!args[0]) fail(`Usage: opencv screen <${SCREEN_LAYOUTS.join('|')}> [--name] [--title] [--action]`);
    try { out(screenSnippet(loadKit(), args[0], flags)); } catch (e) { fail(e.message); }
  },

  lint({ args, flags }) {
    const kit = loadKit();
    let tree;
    try { tree = parseDump(readInput(args[0])); } catch (e) { fail(e.message); }
    const all = lintTree(kit, tree);
    const shown = flags.verbose ? all : all.filter((f) => f.level !== 'info');
    if (flags.json) out(JSON.stringify(shown, null, 2));
    else {
      for (const f of shown) {
        const tag = f.level === 'error' ? red('error  ') : f.level === 'warning' ? yellow('warning') : dim('info   ');
        out(`${tag} ${cyan(pad(f.rule, 18))} ${dim(f.id)}  ${f.message}`);
        if (f.path) out(dim(`        ${f.path}`));
      }
      const e = all.filter((f) => f.level === 'error').length;
      const w = all.filter((f) => f.level === 'warning').length;
      const i = all.length - e - w;
      out((e ? red : w ? yellow : green)(`\n${e} errors, ${w} warnings`) + dim(`, ${i} hints${flags.verbose ? '' : ' (--verbose to show)'}`));
    }
    if (all.some((f) => f.level === 'error')) process.exitCode = 1;
  },

  copy({ args, flags }) {
    const text = args.join(' ');
    if (!text) fail('Usage: opencv copy "<text>"');
    const res = lintText(text);
    if (flags.json) return out(JSON.stringify(res, null, 2));
    if (!res.length) return out(green('ok') + '  ' + text);
    for (const r of res) out(`${r.level === 'error' ? red('error  ') : r.level === 'warning' ? yellow('warning') : dim('info   ')} ${r.message}`);
    if (res.some((r) => r.level === 'error')) process.exitCode = 1;
  },

  export({ args }) {
    const dir = resolve(args[0] || 'opencv-tokens');
    const kit = loadKit();
    mkdirSync(dir, { recursive: true });
    const files = {
      'tokens.css': tokensCss(kit),
      'opencv.preset.cjs': tailwindPreset(kit),
      'tokens.json': JSON.stringify(tokensW3c(kit), null, 2) + '\n',
      'components.json': JSON.stringify(componentsManifest(kit), null, 2) + '\n',
    };
    for (const [f, body] of Object.entries(files)) writeFileSync(join(dir, f), body);
    out(`Wrote ${Object.keys(files).join(', ')} to ${dir}`);
  },

  sync({ args, flags }) {
    if (flags.snippet || !args[0]) return out(SYNC_SNIPPET);
    let raw;
    try { raw = parseSyncOutput(readInput(args[0])); } catch (e) { fail(e.message); }
    const kit = buildKit(raw);
    const target = flags.out ? resolve(flags.out) : join(root, 'data', 'kit.json');
    writeFileSync(target, JSON.stringify(kit, null, 1) + '\n');
    out(`${green('synced')} ${kit.components.length} components, ${allVariants(kit).length} masters, ${Object.keys(kit.tokens).length} tokens, ${kit.screens.length} screens -> ${target}`);
  },

  skill({ args, flags }) {
    const skills = ['opencv-build', 'opencv-pen'];
    if (!flags.install) return out(readFileSync(join(root, 'skill', 'opencv-build', 'SKILL.md'), 'utf8'));
    const base = resolve(typeof flags.install === 'string' ? flags.install : args[0] || join(homedir(), '.claude', 'skills'));
    for (const name of skills) {
      const from = join(root, 'skill', name);
      const to = join(base, name);
      cpSync(from, to, { recursive: true });
      out(`Installed ${name} -> ${to}`);
    }
  },
};

const PEN_NAMES = ['ls', 'show', 'find', 'layouts', 'screens', 'glow', 'brand', 'snippet', 'screen', 'lint', 'sync', 'tokens', 'copy', 'rules'];
const PEN = Object.fromEntries(PEN_NAMES.map((n) => [n, SHARED[n]]));
for (const n of ['ls', 'find', 'layouts', 'screens', 'glow', 'brand', 'snippet', 'sync']) delete SHARED[n];

const PEN_HELP = `${bold('opencv pen')}  tools for the pen.dev canvas (opencv.pen), used through the pencil MCP execute tool

  guide                         canvas playbook
  ls [query] [--kind k]         components, patterns, flows and masters on the canvas
  show <component>              spec and every master id
  find <words...>               resolve one master from words
  layouts | screens [query]     page templates, real screens on the canvas
  screen <layout>               scaffold snippet: ${SCREEN_LAYOUTS.join(' | ')}
  snippet <words...>            insert a master instance  --label --text Name=Value --parent --x --y
  glow <name> [--snippet]       glow mesh fill
  brand                         "[mark] opencv" heading snippet
  lint <file|->                 lint a pencil Get dump
  sync --snippet | sync <file>  refresh the kit from opencv.pen
`;

export function main(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' }, json: { type: 'boolean' },
        verbose: { type: 'boolean' }, snippet: { type: 'boolean' }, install: { type: 'string' },
        kind: { type: 'string' }, format: { type: 'string' }, out: { type: 'string' },
        label: { type: 'string' }, text: { type: 'string', multiple: true }, icon: { type: 'string', multiple: true },
        parent: { type: 'string' }, x: { type: 'string' }, y: { type: 'string' }, var: { type: 'string' },
        name: { type: 'string' }, width: { type: 'string' }, height: { type: 'string' }, title: { type: 'string' },
        action: { type: 'string' }, sub: { type: 'string' }, state: { type: 'string' }, image: { type: 'string' },
        lead: { type: 'string' }, size: { type: 'string' }, color: { type: 'string' },
        all: { type: 'boolean' }, force: { type: 'boolean' }, source: { type: 'boolean' },
      },
    });
  } catch (e) {
    // `skill --install` with no value
    if (/--install/.test(e.message) && argv.includes('--install')) return main(argv.map((a) => (a === '--install' ? '--install=' : a)));
    fail(e.message);
  }
  const { values: flags, positionals } = parsed;
  if (flags.version) return out(pkg.version);
  let [cmd, ...args] = positionals;
  if (!cmd || cmd === 'help' || (flags.help && cmd !== 'pen')) return out(HELP);
  if (flags.install === '') flags.install = true;
  const code = makeCodeCommands({ out, fail, c: { dim, bold, cyan, green, yellow, red } });
  if (cmd === 'pen') {
    [cmd, ...args] = args;
    if (!cmd || flags.help) return out(PEN_HELP);
    if (cmd === 'guide') return out(PEN_GUIDE);
    const fn = PEN[cmd];
    if (!fn) fail(`Unknown pen command "${cmd}". Run opencv pen --help.`);
    return fn({ args, flags });
  }
  const fn = code[cmd] || SHARED[cmd];
  if (!fn) fail(`Unknown command "${cmd}". Run opencv --help.`);
  fn({ args, flags });
}
