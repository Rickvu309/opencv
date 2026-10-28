// Lints a pen.dev node dump (the JSON returned by pencil `Get`) against the opencv rules.
import { tokenHexMap } from './kit.js';

const DARK_FILLS = new Set(['#1A1A1A', '#1B1B1F', '#2F2F31', '#16161A', '#111111', '#000000', '$ds-action', '$ds-text-primary', '$l-text', '$ds-text-title']);
const WHITE = new Set(['#FFFFFF', '#FFF', '$ds-action-fg', '#F5F5F6', '#FAFAFA']);
const ORANGE = new Set(['$ds-accent', '$ds-accent-soft', '#E8542A', '#FBE7E0', '$l-accent']);
const NOT_BUTTONS = /toast|tooltip|kbd|avatar|badge|dot|num|tag|pill|switch|knob|check|radio|mark|logo|initial|today|send|avatar|selected|step/i;
const FONTS = new Set(['Inter', '$ds-font', 'JetBrains Mono']);
// Meaningful warm colors that the kit uses on purpose (applied stage, warning, deadline text).
const WARM_OK = new Set(['#E2A400', '#CC9F00', '#F8F0D0', '#7A5A00', '#9A7300', '#8A6A00', '#EB5757', '#E04848', '#CC3F3F', '#C53F3F', '#FCE9E9']);

export const TEXT_RULES = [
  { id: 'brand-name', level: 'error', test: (s) => /OpenCV/.test(s), msg: 'Write the brand as [mark] + lowercase "opencv", never "OpenCV".' },
  { id: 'em-dash', level: 'error', test: (s) => /—/.test(s), msg: 'No em dash in UI copy. Use a comma, a period or "to".' },
  { id: 'middle-dot', level: 'error', test: (s) => /·/.test(s), msg: 'No middle dot in UI copy. Use a comma or separate the items.' },
  { id: 'oops', level: 'error', test: (s) => /\boops\b/i.test(s), msg: 'No "Oops". Say what happened and how to fix it.' },
  { id: 'connected', level: 'warning', test: (s) => /^\s*connected\s*$/i.test(s), msg: 'On states read "Enabled".' },
  { id: 'exclamation', level: 'warning', test: (s) => /[A-Za-z]!(\s|$)/.test(s), msg: 'No exclamation marks in product copy.' },
  { id: 'credits', level: 'warning', test: (s) => /\b\d+\s+credits?\b/i.test(s), msg: 'No credit numbers. Show usage as a percentage.' },
  { id: 'title-case', level: 'info', test: (s) => /^([A-Z][a-z]+ ){2,}[A-Z][a-z]+$/.test(s.trim()) && s.trim().split(' ').length <= 5, msg: 'Labels use sentence case.' },
];

export function lintText(text) {
  return TEXT_RULES.filter((r) => r.test(text)).map((r) => ({ rule: r.id, level: r.level, message: r.msg }));
}

function hexOf(v) {
  if (typeof v !== 'string' || !v.startsWith('#')) return null;
  let h = v.slice(1).toUpperCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return h.length >= 6 ? '#' + h.slice(0, 6) : null;
}

function hsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function colorsIn(fill) {
  const out = [];
  const visit = (f) => {
    if (!f) return;
    if (typeof f === 'string') out.push(f);
    else if (Array.isArray(f)) f.forEach(visit);
    else if (typeof f === 'object') {
      if (f.color) out.push(f.color);
      if (Array.isArray(f.colors)) f.colors.forEach((c) => out.push(typeof c === 'string' ? c : c.color));
    }
  };
  visit(fill);
  return out.filter(Boolean);
}

function fillsOf(fill) {
  return Array.isArray(fill) ? fill : fill ? [fill] : [];
}

export function lintTree(kit, root) {
  const findings = [];
  const tokenHex = tokenHexMap(kit);
  const glowHex = new Set(Object.values(kit.glow).flatMap((g) => g.colors.map((c) => c.toUpperCase())));
  const deprecated = new Map(kit.deprecated.map((d) => [d.id, d]));
  const add = (node, path, rule, level, message) => findings.push({ id: node.id || '?', path: path.join(' > '), rule, level, message });

  const checkColor = (node, path, value, where) => {
    if (ORANGE.has(value) || hexOf(value) === '#E8542A') return add(node, path, 'orange-accent', 'error', `${where} uses the reserved orange. No orange dots or tints; use ds-text-primary or a grey icon.`);
    const hex = hexOf(value);
    if (!hex || glowHex.has(hex)) return;
    const { h, s, l } = hsl(hex);
    if (!WARM_OK.has(hex) && s > 0.25 && l > 0.08 && l < 0.97 && h >= 12 && h <= 55) add(node, path, 'warm-tint', 'error', `${where} ${value} is a warm tint. The app stays cool and grayscale.`);
    else if (tokenHex.has(hex)) add(node, path, 'use-token', 'info', `${where} ${value} equals $${tokenHex.get(hex)[0]}. Use the token.`);
  };

  const walk = (node, path, overrideOnly) => {
    if (!node || typeof node !== 'object') return;
    const label = node.name || node.type || node.id || '';
    const here = label ? [...path, label] : path;

    if (node.type === 'ref' && deprecated.has(node.ref)) {
      const d = deprecated.get(node.ref);
      add(node, here, 'deprecated-master', 'warning', `Uses deprecated ${d.name}. Use ${d.replacement || 'the 1.3 replacement'}.`);
    }

    if (node.type === 'text' || (overrideOnly && typeof node.content === 'string')) {
      if (typeof node.content === 'string') for (const f of lintText(node.content)) add(node, here, f.rule, f.level, `"${node.content.slice(0, 40)}": ${f.message}`);
      if (node.type === 'text' && !overrideOnly && node.fill === undefined) add(node, here, 'text-no-fill', 'error', 'Text has no fill and will be invisible.');
      if (node.fontFamily && !FONTS.has(node.fontFamily)) add(node, here, 'font', 'warning', `Font "${node.fontFamily}". Use Inter ($ds-font).`);
      if (typeof node.fontSize === 'number' && node.fontSize >= 20 && node.fontSize <= 36 && typeof node.content === 'string' && node.content.trim().split(/\s+/).length > 7)
        add(node, here, 'long-heading', 'warning', `Heading has ${node.content.trim().split(/\s+/).length} words. Keep headings to 2 to 4.`);
    }

    for (const f of fillsOf(node.fill)) {
      if (f && f.type === 'mesh_gradient' && !Array.isArray(f.points)) add(node, here, 'mesh-points', 'error', 'mesh_gradient without points is dropped. Pass the 9 explicit points (opencv glow prints them).');
    }
    for (const c of colorsIn(node.fill)) checkColor(node, here, c, 'Fill');
    for (const c of colorsIn(node.stroke)) checkColor(node, here, c, 'Stroke');

    const solid = typeof node.fill === 'string' ? (node.fill.startsWith('#') ? node.fill.toUpperCase() : node.fill) : null;
    if (node.type === 'frame' && Array.isArray(node.children) && solid && DARK_FILLS.has(solid)) {
      const h = typeof node.height === 'number' ? node.height : 0;
      const whiteText = node.children.some((c) => (c.type === 'text' || c.type === 'icon') && typeof c.fill === 'string' && WHITE.has(c.fill.toUpperCase()));
      if (h > 0 && h <= 48 && whiteText && node.children.some((c) => c.type === 'text') && !NOT_BUTTONS.test(node.name || '') && !/danger/i.test(node.name || ''))
        add(node, here, 'black-primary', 'error', 'Looks like a black primary button. Primary buttons use the glow (Button/Primary masters).');
    }

    const imgFill = fillsOf(node.fill).find((f) => f && f.type === 'image');
    if (imgFill && /screen|shot|window/i.test(node.name || '') && typeof node.width === 'number' && typeof node.height === 'number') {
      const ratio = node.width / node.height;
      if (Math.abs(ratio - 1.6) / 1.6 > 0.04) add(node, here, 'screenshot-ratio', 'warning', `Screenshot is ${node.width}x${node.height} (${ratio.toFixed(2)}). Keep 16:10: height ${Math.round(node.width / 1.6)}.`);
    }

    if (Array.isArray(node.children)) for (const c of node.children) walk(c, here, false);
    if (node.descendants && typeof node.descendants === 'object') {
      for (const [k, v] of Object.entries(node.descendants)) walk({ id: `${node.id}/${k}`, ...v, name: v.name || k }, here, !v.type);
    }
  };

  for (const n of Array.isArray(root) ? root : [root]) walk(n, [], false);
  return findings;
}

// Accepts raw JSON or text printed by `Print(JSON.stringify(...))`, possibly with other lines around it.
export function parseDump(text) {
  const t = text.trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const nodes = [];
  for (const line of t.split('\n')) {
    const s = line.trim().replace(/^Print output\s*/i, '');
    const start = s.search(/[[{]/);
    if (start < 0) continue;
    try { nodes.push(JSON.parse(s.slice(start))); } catch { /* not json */ }
  }
  if (!nodes.length) throw new Error('No JSON found. Dump the node with Print(JSON.stringify(Get(id, { depth: 30 }))).');
  return nodes.length === 1 ? nodes[0] : nodes;
}
