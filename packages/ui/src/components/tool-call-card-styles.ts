export const css = `
.ui-tcc,
.ui-tcc-group {
  --ui-tcc-card: var(--card);
  --ui-tcc-strong: var(--foreground);
  --ui-tcc-ink: var(--foreground);
  --ui-tcc-text: var(--muted-foreground);
  --ui-tcc-muted: var(--muted-foreground);
  --ui-tcc-faint: color-mix(in oklab, var(--muted-foreground) 60%, transparent);
  --ui-tcc-icon: var(--muted-foreground);
  --ui-tcc-line: var(--border);
  --ui-tcc-wash: color-mix(in oklab, var(--muted) 50%, transparent);
  --ui-tcc-wash-big: color-mix(in oklab, var(--muted) 30%, transparent);
  --ui-tcc-code: var(--muted);
  --ui-tcc-accent: var(--foreground);
  --ui-tcc-red: var(--destructive);
  --ui-tcc-red-bg: color-mix(in oklab, var(--destructive) 6%, transparent);
  --ui-tcc-red-line: color-mix(in oklab, var(--destructive) 25%, transparent);
  --ui-tcc-key: var(--foreground);
  --ui-tcc-str: var(--muted-foreground);
  --ui-tcc-num: var(--muted-foreground);
  --ui-tcc-lit: var(--muted-foreground);
  --ui-tcc-shine: color-mix(in oklab, var(--card) 82%, transparent);
  --ui-tcc-shadow: 0 0 0 1px var(--border);
  --ui-tcc-focus: color-mix(in oklab, var(--ring) 50%, transparent);
  --ui-tcc-ease: var(--ease-micro);
  --ui-tcc-mono: var(--font-mono, ui-monospace, monospace);
  box-sizing: border-box;
  container-type: inline-size;
  min-width: 0;
  color: var(--ui-tcc-ink);
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 20px;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
}
.ui-tcc *,
.ui-tcc-group * { box-sizing: border-box; }

.ui-tcc {
  position: relative;
  border-radius: 10px;
  background: var(--ui-tcc-card);
  box-shadow: var(--ui-tcc-shadow);
}
.ui-tcc-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.ui-tcc__head {
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color var(--duration-micro) ease, border-radius 0ms linear var(--duration-panel);
}
.ui-tcc[data-open] .ui-tcc__head {
  border-radius: 10px 10px 0 0;
  transition: background-color var(--duration-micro) ease;
}
.ui-tcc__head:focus-visible,
.ui-tcc-group__head:focus-visible,
.ui-tcc__copy:focus-visible,
.ui-tcc__more:focus-visible,
.ui-tcc__retry:focus-visible {
  outline: 2px solid var(--ui-tcc-focus);
  outline-offset: 1px;
}
@media (hover: hover) {
  .ui-tcc__head:hover { background: var(--ui-tcc-wash-big); }
  .ui-tcc__head:hover .ui-tcc__chevron { stroke: var(--ui-tcc-ink); }
  .ui-tcc-group__head:hover { background: var(--ui-tcc-wash); color: var(--ui-tcc-ink); }
  .ui-tcc__copy:hover { background: var(--ui-tcc-wash-big); color: var(--ui-tcc-ink); }
  .ui-tcc__more:hover { color: var(--ui-tcc-ink); }
  .ui-tcc__retry:hover { background: var(--ui-tcc-wash-big); }
}

.ui-tcc__icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 16px;
  height: 16px;
  color: var(--ui-tcc-icon);
}
.ui-tcc__icon > svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }

.ui-tcc__main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.ui-tcc__name {
  flex: 0 1 auto;
  max-width: 100%;
  overflow: hidden;
  color: var(--ui-tcc-strong);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ui-tcc__summary {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  color: var(--ui-tcc-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-tcc__awaiting {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
}
.ui-tcc__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  color: var(--ui-tcc-muted);
  font-size: 12px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  animation: ui-tcc-in var(--duration-panel) var(--ui-tcc-ease) both;
}
.ui-tcc[data-status="error"] .ui-tcc__status { color: var(--ui-tcc-red); font-weight: 500; }
.ui-tcc__status > svg { width: 14px; height: 14px; flex: none; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.ui-tcc__spinner circle { stroke: var(--ui-tcc-line); stroke-width: 1.6; }
.ui-tcc__spinner path { stroke: var(--ui-tcc-accent); stroke-width: 1.6; }
.ui-tcc__spinner { animation: ui-tcc-spin 800ms linear infinite; }
.ui-tcc__ok { animation: ui-tcc-pop var(--duration-panel) var(--ease-micro) both; }
.ui-tcc__ok circle { fill: var(--ui-tcc-accent); }
.ui-tcc__ok path { stroke: var(--primary-foreground); stroke-width: 1.5; stroke-dasharray: 1; stroke-dashoffset: 1; animation: ui-tcc-draw var(--duration-panel) var(--ui-tcc-ease) var(--duration-micro) forwards; }
.ui-tcc__err circle { fill: var(--ui-tcc-red); }
.ui-tcc__err path { stroke: var(--primary-foreground); stroke-width: 1.6; stroke-linecap: round; }

.ui-tcc__chevron {
  flex: none;
  width: 12px;
  height: 12px;
  fill: none;
  stroke: var(--ui-tcc-icon);
  stroke-width: 1.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform var(--duration-panel) var(--ui-tcc-ease), stroke var(--duration-micro) ease;
}
.ui-tcc[data-open] > .ui-tcc__head .ui-tcc__chevron,
.ui-tcc-group[data-open] > .ui-tcc-group__head .ui-tcc__chevron { transform: rotate(180deg); }

.ui-tcc__body {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows var(--duration-panel) var(--ui-tcc-ease), opacity var(--duration-panel) ease;
}
.ui-tcc[data-open] > .ui-tcc__body,
.ui-tcc-group[data-open] > .ui-tcc__body {
  grid-template-rows: 1fr;
  opacity: 1;
}
.ui-tcc__clip { min-height: 0; overflow: hidden; }
.ui-tcc__sections {
  display: grid;
  gap: 14px;
  padding: 12px 14px 14px;
  border-top: 0.5px solid var(--ui-tcc-line);
}

.ui-tcc__section { display: grid; gap: 6px; min-width: 0; }
.ui-tcc__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 28px;
}
.ui-tcc__label {
  color: var(--ui-tcc-muted);
  font-size: 10px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.ui-tcc__pending { margin: 0; color: var(--ui-tcc-muted); font-size: 12px; line-height: 16px; }

.ui-tcc__copy {
  all: unset;
  position: relative;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--ui-tcc-card);
  box-shadow: var(--ui-tcc-shadow);
  color: var(--ui-tcc-icon);
  cursor: pointer;
  transition: background-color var(--duration-micro) ease, color var(--duration-micro) ease;
}
.ui-tcc__copy svg {
  position: absolute;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: opacity var(--duration-micro) ease, transform var(--duration-panel) var(--ui-tcc-ease), filter var(--duration-micro) ease;
}
.ui-tcc__copy-icon rect { fill: currentColor; stroke: none; }
.ui-tcc__copy-done { opacity: 0; transform: scale(0.6); filter: blur(2px); stroke-width: 1.7; }
.ui-tcc__copy[data-copied] { color: var(--ui-tcc-accent); }
.ui-tcc__copy[data-copied] .ui-tcc__copy-icon { opacity: 0; transform: scale(0.6); filter: blur(2px); }
.ui-tcc__copy[data-copied] .ui-tcc__copy-done { opacity: 1; transform: none; filter: none; }

.ui-tcc__code {
  position: relative;
  margin: 0;
  padding: 10px 12px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--ui-tcc-code);
  box-shadow: inset 0 0 0 0.5px var(--ui-tcc-line);
  color: var(--ui-tcc-muted);
  font-family: var(--ui-tcc-mono);
  font-size: 12px;
  line-height: 20px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  tab-size: 2;
  transition: max-height var(--duration-panel) var(--ui-tcc-ease);
}
.ui-tcc__code code { display: block; font: inherit; }
.ui-tcc__code::after {
  content: "";
  position: absolute;
  left: 0.5px;
  right: 0.5px;
  bottom: 0.5px;
  height: 56px;
  border-radius: 0 0 7.5px 7.5px;
  background: linear-gradient(to bottom, transparent, var(--ui-tcc-code));
  opacity: 0;
  transition: opacity var(--duration-panel) ease;
  pointer-events: none;
}
.ui-tcc__code[data-capped]::after { opacity: 1; }
.ui-tcc__t-key { color: var(--ui-tcc-key); }
.ui-tcc__t-str { color: var(--ui-tcc-str); }
.ui-tcc__t-num { color: var(--ui-tcc-num); }
.ui-tcc__t-lit { color: var(--ui-tcc-lit); }

.ui-tcc__more {
  all: unset;
  justify-self: start;
  padding: 2px 4px;
  margin-left: -4px;
  border-radius: 6px;
  color: var(--ui-tcc-text);
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: color var(--duration-micro) ease;
}

.ui-tcc__error {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 8px 8px 8px 12px;
  border-radius: 8px;
  background: var(--ui-tcc-red-bg);
  box-shadow: inset 0 0 0 0.5px var(--ui-tcc-red-line);
}
.ui-tcc__error > .ui-tcc__err { flex: none; align-self: flex-start; width: 16px; height: 16px; margin-top: 6px; }
.ui-tcc__error-text {
  flex: 1;
  min-width: 0;
  margin: 0;
  color: var(--ui-tcc-red);
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.ui-tcc__retry {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  height: 28px;
  padding: 0 10px 0 6px;
  border-radius: 6px;
  background: var(--ui-tcc-card);
  box-shadow: var(--ui-tcc-shadow);
  color: var(--ui-tcc-strong);
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--duration-micro) ease;
}
.ui-tcc__retry svg { width: 16px; height: 16px; fill: none; stroke: var(--ui-tcc-icon); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.ui-tcc__retry:active svg { transform: rotate(-60deg); transition: transform var(--duration-micro) var(--ui-tcc-ease); }

.ui-tcc-group { display: grid; }
.ui-tcc-group__head {
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  justify-self: start;
  max-width: 100%;
  min-height: 32px;
  margin-left: -6px;
  padding: 4px 10px 4px 6px;
  border-radius: 8px;
  color: var(--ui-tcc-ink);
  cursor: pointer;
  transition: background-color var(--duration-micro) ease, color var(--duration-micro) ease;
}
.ui-tcc-group__stack { display: flex; flex: none; padding: 0.5px; }
.ui-tcc-group__stack .ui-tcc__icon {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--ui-tcc-card);
  box-shadow: var(--ui-tcc-shadow);
  animation: ui-tcc-pop var(--duration-panel) var(--ui-tcc-ease) both;
}
.ui-tcc-group__stack .ui-tcc__icon + .ui-tcc__icon { margin-left: -4px; }
.ui-tcc-group__stack .ui-tcc__icon > svg { width: 12px; height: 12px; stroke-width: 1.5; }
.ui-tcc-group__title {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  white-space: nowrap;
  animation: ui-tcc-in var(--duration-panel) var(--ui-tcc-ease) both;
}
.ui-tcc-group__label {
  position: relative;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: inherit;
  font-weight: 500;
}
.ui-tcc-group__label.ui-tcc__shine { color: var(--ui-tcc-muted); }
.ui-tcc-group__failed { flex: none; color: var(--ui-tcc-red); }
.ui-tcc-group__time { flex: none; color: var(--ui-tcc-faint); font-variant-numeric: tabular-nums; }
.ui-tcc-group__list { display: grid; gap: 8px; padding: 6px 0 2px; }

.ui-tcc__shine::after {
  content: attr(data-text);
  content: attr(data-text) / "";
  position: absolute;
  inset: 0;
  white-space: nowrap;
  color: transparent;
  background: linear-gradient(90deg, transparent 38%, var(--ui-tcc-shine) 50%, transparent 62%) 100% 0 / 300% 100% no-repeat;
  -webkit-background-clip: text;
  background-clip: text;
  animation: ui-tcc-sweep 1.8s linear infinite;
  pointer-events: none;
}

@keyframes ui-tcc-in {
  from { opacity: 0; transform: translateY(3px); filter: blur(2px); }
  to { opacity: 1; transform: none; filter: none; }
}
@keyframes ui-tcc-pop {
  from { opacity: 0; transform: scale(0.6); }
  to { opacity: 1; transform: none; }
}
@keyframes ui-tcc-spin { to { transform: rotate(360deg); } }
@keyframes ui-tcc-draw { to { stroke-dashoffset: 0; } }
@keyframes ui-tcc-sweep {
  from { background-position: 100% 0; }
  to { background-position: 0% 0; }
}

@container (max-width: 360px) {
  .ui-tcc__head { gap: 8px; padding: 0 12px; }
  .ui-tcc__sections { padding: 12px 12px 12px; }
}
@media (pointer: coarse) {
  .ui-tcc__head { min-height: 52px; }
}
@media (prefers-reduced-motion: reduce) {
  .ui-tcc *,
  .ui-tcc-group *,
  .ui-tcc *::after,
  .ui-tcc-group *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
  }
  .ui-tcc__shine::after { display: none; }
  .ui-tcc__ok path { stroke-dashoffset: 0; }
}
`
