/**
 * @schema 2.11
 * @input dash: number = 4
 * @input gap: number = 3
 * @input thickness: number = 1.2
 * @input color: color = #B4B4BA
 */
const w = pencil.width;
const h = pencil.height;
const t0 = pencil.input.thickness / 2;
const r = h / 2 - t0;
const cx1 = h / 2;
const cx2 = w - h / 2;
const cy = h / 2;
const straight = Math.max(0, cx2 - cx1);
const arc = Math.PI * r;
const total = 2 * straight + 2 * arc;
const period = pencil.input.dash + pencil.input.gap;
const count = Math.max(1, Math.round(total / period));
const step = total / count;
const dash = step * (pencil.input.dash / period);

const pointAt = (t) => {
  t = ((t % total) + total) % total;
  if (t < straight) return [cx1 + t, cy - r];
  t -= straight;
  if (t < arc) {
    const a = -Math.PI / 2 + t / r;
    return [cx2 + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  t -= arc;
  if (t < straight) return [cx2 - t, cy + r];
  t -= straight;
  const a = Math.PI / 2 + t / r;
  return [cx1 + r * Math.cos(a), cy + r * Math.sin(a)];
};

const f = (n) => n.toFixed(2);
let d = "";
for (let i = 0; i < count; i++) {
  const start = i * step;
  const parts = 3;
  for (let k = 0; k <= parts; k++) {
    const [x, y] = pointAt(start + (dash * k) / parts);
    d += (k === 0 ? "M" : "L") + f(x) + " " + f(y) + " ";
  }
}

return [
  {
    type: "path",
    name: "Dashed outline",
    x: 0,
    y: 0,
    width: w,
    height: h,
    viewBox: [0, 0, w, h],
    geometry: d.trim(),
    stroke: pencil.input.color,
    strokeWidth: pencil.input.thickness,
    strokeLinecap: "round",
  },
];
