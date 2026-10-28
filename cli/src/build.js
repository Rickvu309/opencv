// Turns a raw pen.dev extraction (see `opencv sync --snippet`) into data/kit.json.

export const GLOW = {
  hero: { use: 'Landing hero shot', center: [0.62, 0.55], colors: ['#E4E9F6', '#C3CFEE', '#DCD9F2', '#B9C8EC', '#8EA4E0', '#C7C2EC', '#D9E1F4', '#AFC0EA', '#E2E0F5'] },
  paper: { use: 'Paper shot, blog covers', center: [0.38, 0.5], colors: ['#E9E7F4', '#CFCAEB', '#E4E8F5', '#C6C0E8', '#A79FDD', '#C9D1EE', '#ECEAF6', '#D1CCEC', '#E6E9F5'] },
  apply: { use: 'Apply shot', center: [0.6, 0.45], colors: ['#E2EEF3', '#BFDCE8', '#DCE6F4', '#B3D3E3', '#86B6D3', '#BBCDEA', '#E4EFF4', '#BCD8E6', '#DFE8F4'] },
  coach: { use: 'Coach shot', center: [0.45, 0.55], colors: ['#E4F1F2', '#C6E3E6', '#DCE3F5', '#BCDDE2', '#93C4CF', '#B9C6EE', '#E7F2F3', '#C3DFE4', '#E0E6F6'] },
  proof: { use: 'Proof card', center: [0.6, 0.5], colors: ['#E3F0EC', '#C2E1D8', '#DDE8F2', '#B5DACF', '#8CC3B6', '#BCD3EA', '#E6F1EE', '#C0DED6', '#DFE9F3'] },
  pitch: { use: 'Pitch card', center: [0.4, 0.5], colors: ['#E8E6F6', '#CDC8EE', '#E1E8F6', '#C3BDEB', '#A49BE0', '#C2CFEE', '#EAE8F6', '#CBC6EC', '#E3E9F6'] },
  card: { use: 'Story card, Pro plan card', center: [0.6, 0.55], colors: ['#F3F4FA', '#E4E8F6', '#EEF0F8', '#E0E5F5', '#CBD5F0', '#E3E1F4', '#F4F5FA', '#E6E9F6', '#F1F0F8'] },
  button: { use: 'Every primary button', center: [0.55, 0.6], colors: ['#EAEFFA', '#D6DFF6', '#E7E3F9', '#D0DAF5', '#BCCAF1', '#DCD6F6', '#E6EBF9', '#CED9F4', '#E9E5F9'] },
};

// Page templates from 1.4 Layouts and headers.
export const LAYOUTS = {
  app: { name: 'App shell', use: 'Any app page with one main panel', regions: 'sidebar 244, main panel r8 inset 8, header h52 px20, bottom dock h40', header: 'Header/Page' },
  board: { name: 'Board, list, calendar', use: 'Apply views', regions: 'header h52, toolbar h44 with view tabs, lanes w244 r6 #FAFAFA', header: 'Header/Page + Header/Toolbar' },
  list: { name: 'List and reading pane', use: 'Inbox', regions: 'list pane w460, detail header h44, read pane fill', header: 'Header/List + Header/Reading' },
  detail: { name: 'Detail with rail', use: 'Job detail', regions: 'main column max 720, rail w288 #FAFAFA', header: 'Header/Detail' },
  document: { name: 'Document', use: 'Paper editor', regions: 'top bar, desk #F4F4F6, page w560 A4 ratio', header: 'Header/Document' },
  gallery: { name: 'Gallery', use: 'Paper library, templates', regions: 'header with search and New, cards 150x212 r8', header: 'Header/Page' },
  chat: { name: 'Chat', use: 'Coach', regions: 'thread column w720, composer w720 sticky', header: 'Header/Chat' },
  settings: { name: 'Settings', use: 'Settings pages', regions: 'settings nav 244, column w640 pt56 on ds-bg-canvas', header: 'Header/Settings' },
  auth: { name: 'Auth split', use: 'Sign in', regions: 'form w340 left, lit mark panel right', header: 'none' },
  state: { name: 'Centered state', use: 'Empty, error, coming soon', regions: 'state w360 centered in main panel', header: 'Header/Page' },
};

// Fixed ids inside the masters that scaffolds rely on.
export const SHELL = {
  appShell: 'cxAxL',
  mainPanel: 'GIhbq',
  authLayout: 'P23Lk',
  authFormSlot: 'k5PSXG',
  settingsTemplate: 'qCgR7',
  settingsColumn: 'MbGQO',
};

const KIND = { components: 'component', patterns: 'pattern', masters: 'master' };

export function slug(s) {
  return String(s).replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function familyOf(name) {
  const clean = name.replace(/^Deprecated \/ /, '').replace(/^OC /, '');
  return clean.split('/')[0].trim();
}

export function buildKit(raw) {
  const mastersById = new Map(raw.masters.map((m) => [m.id, m]));
  const components = [];
  const deprecated = [];
  const editorSpecs = {
    FloatingPill: { desc: 'Short status over the canvas. Always bottom center, 28px from the bottom edge. One at a time.', spec: { Props: 'tone: progress | warning | success | error\nlabel, meta?, secondary?, primary?', Tokens: 'bg ds-bg-surface, border ds-border, radius pill, height 36' } },
    Suggestion: { desc: 'Coach advice that waits for the user. Sits in the right margin, next to the block it is about.', spec: { Props: 'anchor: blockId\ntitle, body, primary?, secondary?, onDismiss', Tokens: 'bg ds-bg-surface, border ds-border, radius 12, title 13, body 12' } },
    NoticeBar: { desc: 'Sits above the page. Tells what happened and the one thing to do next.', spec: { Props: 'icon, message, status?: { count, label }, action', Tokens: 'bg ds-bg-surface, border ds-border, radius 10, height 46, width 560' } },
    StateMessage: { desc: 'Centered empty or error state. One title, one helper line, max two actions.', spec: { Props: 'icon, title (2 to 4 words), helper (one line), primary?, secondary?', Tokens: 'tile ds-bg-surface border, title 15/600, helper 13 tertiary, buttons h32' } },
  };

  for (const sec of raw.sections) {
    if (!sec.name || sec.name === 'Head') continue;
    const variants = sec.masters.map((id) => mastersById.get(id)).filter(Boolean);
    if (sec.name === 'Deprecated') {
      for (const m of variants) deprecated.push({ id: m.id, name: m.name.replace(/^Deprecated \/ /, '') });
      continue;
    }
    const extra = editorSpecs[sec.name];
    const families = [...new Set(variants.map((v) => familyOf(v.name)))];
    components.push({
      key: slug(sec.name),
      name: sec.name,
      kind: sec.kind === 'patterns' && /Steps/.test(Object.keys(sec.spec).join()) ? 'flow' : KIND[sec.kind],
      board: sec.board,
      desc: sec.desc || (extra && extra.desc) || '',
      spec: Object.keys(sec.spec).length ? sec.spec : (extra ? extra.spec : {}),
      families,
      aliases: families.map(slug).filter((f) => f !== slug(sec.name)),
      variants: variants.map((v) => ({
        id: v.id,
        name: v.name,
        parts: v.name.replace(/^OC /, '').split('/').map((p) => p.trim()),
        width: v.width ?? null,
        height: v.height ?? null,
        texts: (v.texts || []).filter((t) => typeof t.content === 'string').map((t) => ({ id: t.id, name: t.name, content: t.content })),
        icons: (v.icons || []).map((i) => ({ id: i.id, name: i.name, icon: i.icon })),
      })),
    });
  }

  const seen = new Set();
  for (const c of components) {
    if (seen.has(c.key)) c.key = `${c.key}-${c.kind}`;
    seen.add(c.key);
  }
  for (const c of components) {
    if (c.variants.length) continue;
    c.seeAlso = components.filter((o) => o !== c && o.aliases.includes(c.key)).map((o) => o.key);
  }

  const replacements = {
    'OC Button primary': 'Button/Primary/SM', 'OC Button secondary': 'Button/Secondary/SM', 'OC Button ghost': 'Button/Ghost/SM',
    'OC Button danger': 'Button/Danger/SM', 'OC Icon button': 'Icon button/28', 'OC Badge': 'Badge/Neutral', 'OC Kbd': 'Menu item (kbd)',
    'OC Page header': 'Header/Page', 'OC Input': 'Search', 'OC Field': 'Field', 'OC Segmented': 'Segmented', 'OC Menu item': 'Menu item',
    'OC Menu': 'Menu item', 'OC Dialog': 'Dialog/Default', 'OC Toast': 'Toast/Success', 'OC Banner': 'Banner/Info',
    'OC Opportunity card': 'OC Job card', 'OC Table row': 'Job row', 'OC Chip': 'Chip',
  };
  for (const d of deprecated) d.replacement = replacements[d.name] || null;

  const tokens = {};
  for (const [k, v] of Object.entries(raw.variables)) tokens[k] = { type: v.type, value: v.value };

  return {
    schema: 1,
    source: 'opencv.pen',
    generatedAt: new Date().toISOString(),
    shell: SHELL,
    tokens,
    glow: GLOW,
    layouts: LAYOUTS,
    components,
    deprecated,
    screens: raw.screens.map((s) => ({ id: s.id, name: s.name, ref: s.ref })).sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true })),
  };
}

// Parses text printed by the sync snippet: @@KIT@@<len> then @@CHUNKn@@...@@END@@ blocks.
export function parseSyncOutput(text) {
  const head = text.match(/@@KIT@@(\d+)/);
  if (!head) throw new Error('No @@KIT@@ marker found. Run the snippet from `opencv sync --snippet` and save its full output.');
  const chunks = [...text.matchAll(/@@CHUNK(\d+)@@([\s\S]*?)@@END@@/g)].sort((a, b) => Number(a[1]) - Number(b[1]));
  const json = chunks.map((c) => c[2]).join('');
  if (json.length !== Number(head[1])) throw new Error(`Expected ${head[1]} characters, got ${json.length}. The output was cut off.`);
  return JSON.parse(json);
}

export const SYNC_SNIPPET = `// Run with the pencil execute tool on opencv.pen, save the full printed output to a file,
// then: opencv sync <that-file>
const boards={FIZL5:'components',B4iHj:'components',L1W32E:'components',CiMk0:'components',EK8si:'patterns',JufVz:'patterns',hzktK:'patterns',SMI9p:'patterns',hvocI:'masters',S1JHUS:'masters'};
const out={boards:[],sections:[],masters:[]};
for(const bid in boards){const b=Get(bid,{depth:1});out.boards.push({id:bid,name:b.name,kind:boards[bid]});
 for(const sec of b.children){if(sec.type!=='frame'||sec.name==='Board header')continue;const full=Get(sec.id,{depth:40});
  const kv={};let title=null,desc=null;
  const w=(x)=>{if(x.type==='frame'&&Array.isArray(x.children)){const tx=x.children.filter(c=>c.type==='text');if(x.children.length===2&&tx.length===2&&tx[0].fontSize===11)kv[tx[0].content]=tx[1].content;
     if(x.name==='Spec head'){for(const t of x.children.filter(c=>c.type==='text')){if(t.fontSize>=22&&!title)title=t.content;else if((t.fontSize===14||t.fontSize===15)&&!desc)desc=t.content;}const tr=x.children.find(c=>c.name==='Title row');if(tr){const t=tr.children.find(c=>c.type==='text');if(t&&!title)title=t.content;}}
     x.children.forEach(c=>w(c));}};
  w(full);
  const masters=[];const wm=(x)=>{if(x.reusable){const texts=[],icons=[];const wt=(y,d)=>{if(d>4)return;if(y.type==='text')texts.push({id:y.id,name:y.name||'',content:y.content});if(y.type==='icon')icons.push({id:y.id,name:y.name||'',icon:y.icon});if(Array.isArray(y.children))y.children.forEach(c=>wt(c,d+1));};(x.children||[]).forEach(c=>wt(c,1));
     masters.push({id:x.id,name:x.name,type:x.type,width:x.width,height:x.height,texts:texts.slice(0,8),icons:icons.slice(0,6)});return;}if(Array.isArray(x.children))x.children.forEach(wm);};
  wm(full);
  out.sections.push({board:bid,kind:boards[bid],id:sec.id,name:title||sec.name,desc,spec:kv,masters:masters.map(m=>m.id)});
  for(const m of masters)out.masters.push(Object.assign(m,{board:bid,section:title||sec.name}));}}
const v=GetVariables().variables;out.variables={};for(const k in v)out.variables[k]={type:v[k].type,value:v[k].value};
out.screens=[];Get(undefined,{depth:1},(n,c)=>{if(/^W\\d+\\.\\d+/.test(n.name||''))out.screens.push({id:n.id,name:n.name,type:n.type,ref:n.ref||null});c.skipChildren();});
const s=JSON.stringify(out);Print('@@KIT@@'+s.length);for(let i=0;i<s.length;i+=60000)Print('@@CHUNK'+(i/60000)+'@@'+s.slice(i,i+60000)+'@@END@@');`;
