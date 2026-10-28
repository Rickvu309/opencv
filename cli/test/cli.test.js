import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKit, resolveVariant, findComponent } from '../src/kit.js';
import { lintTree, lintText, parseDump } from '../src/lint.js';
import { instanceSnippet, meshFill } from '../src/snippet.js';
import { screenSnippet, SCREEN_LAYOUTS } from '../src/screen.js';
import { parseSyncOutput } from '../src/build.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = join(root, 'bin', 'opencv.js');
const run = (...args) => execFileSync('node', [bin, ...args], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
const kit = loadKit();
const rules = (findings) => findings.map((f) => f.rule);

test('kit has the core masters', () => {
  assert.ok(kit.components.length > 40);
  const ids = new Set(kit.components.flatMap((c) => c.variants.map((v) => v.id)));
  for (const id of ['cxAxL', 'aD7Ua', 'FRVf9', 'Ru1A6', 'ojNtV']) assert.ok(ids.has(id), id);
});

test('resolveVariant picks sensible defaults', () => {
  assert.equal(resolveVariant(kit, ['button']).variant.name, 'Button/Primary/MD/Default');
  assert.equal(resolveVariant(kit, ['button', 'secondary', 'lg']).variant.name, 'Button/Secondary/LG/Default');
  assert.equal(resolveVariant(kit, ['checkbox', 'mixed']).variant.name, 'Checkbox/Mixed/Default');
  assert.equal(resolveVariant(kit, ['settings', 'row', 'toggle']).variant.name, 'Settings row/Toggle/Default');
  assert.equal(resolveVariant(kit, ['aD7Ua']).variant.id, 'aD7Ua');
  assert.equal(resolveVariant(kit, ['nothing-like-this']).variant, null);
});

test('findComponent resolves keys and aliases', () => {
  assert.equal(findComponent(kit, 'button').key, 'button');
  assert.equal(findComponent(kit, 'checkbox').key, 'switch-checkbox-radio');
  assert.equal(findComponent(kit, 'Text field').key, 'text-field');
});

test('instance snippet inserts a ref and overrides text by name', () => {
  const v = resolveVariant(kit, ['button', 'primary']).variant;
  const s = instanceSnippet(v, { parent: 'P1', texts: { Label: 'Add job' } });
  assert.match(s, /Insert\("P1", \{"type":"ref","ref":"aD7Ua"/);
  assert.match(s, /Update\(node \+ "\/\w+", \{"content":"Add job"\}\)/);
  assert.throws(() => instanceSnippet(v, { texts: { Nope: 'x' } }), /No text "Nope"/);
});

test('every screen layout produces a snippet', () => {
  for (const l of SCREEN_LAYOUTS) {
    const s = screenSnippet(kit, l, { name: 'T', title: 'Apply', x: 0, y: 0 });
    assert.match(s, /Print\(/, l);
    assert.doesNotThrow(() => new Function('Insert', 'Update', 'Get', 'Copy', 'Delete', 'Print', 'FindEmptySpace', 'document', s), l);
  }
  assert.throws(() => screenSnippet(kit, 'nope'), /Unknown layout/);
});

test('mesh fill always has nine points', () => {
  const f = meshFill(kit.glow.button);
  assert.equal(f.points.length, 9);
  assert.equal(f.colors.length, 9);
});

test('text rules', () => {
  assert.deepEqual(rules(lintText('Welcome to OpenCV')), ['brand-name']);
  assert.ok(rules(lintText('Paper — Apply')).includes('em-dash'));
  assert.ok(rules(lintText('CV · Letter')).includes('middle-dot'));
  assert.ok(rules(lintText('Connected')).includes('connected'));
  assert.ok(rules(lintText('Oops! Something broke')).includes('oops'));
  assert.ok(rules(lintText('You have 200 credits')).includes('credits'));
  assert.deepEqual(lintText('Add job'), []);
});

test('tree rules catch the decisions we made', () => {
  const tree = {
    id: 'root', type: 'frame', name: 'Screen', children: [
      { id: 'b1', type: 'frame', name: 'Add', height: 32, fill: '#1A1A1A', children: [{ id: 't1', type: 'text', content: 'Add job', fill: '#FFFFFF' }] },
      { id: 'd1', type: 'ellipse', name: 'Unread', fill: '#E8542A' },
      { id: 'w1', type: 'frame', name: 'Glow', fill: '#F6E3D3' },
      { id: 'm1', type: 'frame', name: 'Hero', fill: { type: 'mesh_gradient', columns: 3, rows: 3, colors: kit.glow.hero.colors } },
      { id: 's1', type: 'frame', name: 'Screen shot', width: 800, height: 600, fill: { type: 'image', url: 'x.png' } },
      { id: 't2', type: 'text', content: 'Hello' },
      { id: 'f1', type: 'text', content: 'Hi', fill: '#1A1A1A', fontFamily: 'Roboto' },
      { id: 'r1', type: 'ref', ref: 'o9qor' },
      { id: 'i1', type: 'ref', ref: 'cxAxL', descendants: { GIhbq: { children: [{ id: 'x', type: 'text', content: 'Log in to OpenCV', fill: '#1A1A1A' }] } } },
    ],
  };
  const r = rules(lintTree(kit, tree));
  for (const expected of ['black-primary', 'orange-accent', 'warm-tint', 'mesh-points', 'screenshot-ratio', 'text-no-fill', 'font', 'deprecated-master', 'brand-name'])
    assert.ok(r.includes(expected), `missing ${expected}: ${r.join(', ')}`);
});

test('tree rules stay quiet on on-system nodes', () => {
  const tree = {
    id: 'ok', type: 'frame', name: 'Card', fill: '$ds-bg-surface', children: [
      { id: 'b', type: 'ref', ref: 'aD7Ua' },
      { id: 'toast', type: 'frame', name: 'Toast/Success', height: 40, fill: '#1A1A1A', children: [{ id: 'tt', type: 'text', content: 'Saved to Paper', fill: '#FFFFFF' }] },
      { id: 'st', type: 'frame', name: 'Stage', fill: '#E2A400' },
      { id: 'shot', type: 'frame', name: 'Screen', width: 800, height: 500, fill: { type: 'image', url: 'x.png' } },
      { id: 'g', type: 'frame', name: 'Glow', fill: meshFill(kit.glow.paper) },
    ],
  };
  assert.deepEqual(lintTree(kit, tree).filter((f) => f.level !== 'info'), []);
});

test('parseDump reads pencil Print output', () => {
  const text = 'OK\n\n## Print output\n{"id":"a","type":"frame"}  \n{"id":"b","type":"frame"}\n';
  assert.deepEqual(parseDump(text).map((n) => n.id), ['a', 'b']);
});

test('parseSyncOutput checks length', () => {
  const json = JSON.stringify({ a: 1 });
  assert.deepEqual(parseSyncOutput(`@@KIT@@${json.length}\n@@CHUNK0@@${json}@@END@@`), { a: 1 });
  assert.throws(() => parseSyncOutput(`@@KIT@@99\n@@CHUNK0@@${json}@@END@@`), /cut off/);
});

test('cli: help, find, snippet, copy exit codes', () => {
  assert.match(run('pen', '--help'), /screen <layout>/);
  assert.match(run('--help'), /new <dir>/);
  assert.match(run('pen', 'find', 'button', 'danger'), /Button\/Danger\/MD\/Default/);
  assert.match(run('pen', 'snippet', 'button', 'primary', '--label', 'Save'), /"content":"Save"/);
  assert.match(run('copy', 'Add job'), /^ok/);
  assert.throws(() => run('copy', 'Welcome to OpenCV'));
});

test('cli: pen lint exits 1 on errors and 0 when clean', () => {
  const dir = mkdtempSync(join(tmpdir(), 'opencv-'));
  const bad = join(dir, 'bad.json');
  writeFileSync(bad, JSON.stringify({ id: 'x', type: 'text', content: 'OpenCV' }));
  assert.throws(() => run('pen', 'lint', bad));
  const good = join(dir, 'good.json');
  writeFileSync(good, JSON.stringify({ id: 'x', type: 'text', content: 'opencv', fill: '$ds-text-primary' }));
  assert.match(run('pen', 'lint', good), /0 errors/);
});

test('cli: export writes the dev files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'opencv-export-'));
  run('export', dir);
  for (const f of ['tokens.css', 'opencv.preset.cjs', 'tokens.json', 'components.json']) assert.ok(existsSync(join(dir, f)), f);
  const css = readFileSync(join(dir, 'tokens.css'), 'utf8');
  assert.match(css, /--ds-bg-surface: #FFFFFF;/);
  assert.match(css, /\.btn-primary/);
  JSON.parse(readFileSync(join(dir, 'tokens.json'), 'utf8'));
});
