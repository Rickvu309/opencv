precision mediump float;

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/**
 * @label Mark size
 * @default 0.6
 * @range 0.2, 1.4
 */
uniform float u_size;

/**
 * @label Center X
 * @default 0.5
 * @range 0, 1
 */
uniform float u_cx;

/**
 * @label Center Y
 * @default 0.5
 * @range 0, 1
 */
uniform float u_cy;

/**
 * @label Light angle
 * @default 0.6
 * @range -3.14, 3.14
 */
uniform float u_light;

/**
 * @label Rim strength
 * @default 1.6
 * @range 0, 4
 */
uniform float u_rim;

/**
 * @label Beam strength
 * @default 0.55
 * @range 0, 2
 */
uniform float u_beam;

/**
 * @label Halo
 * @default 0.35
 * @range 0, 1.5
 */
uniform float u_halo;

/**
 * @label Base
 * @color
 * @default #040508
 */
uniform vec3 u_base;

/**
 * @label Rim A
 * @color
 * @default #7E93F7
 */
uniform vec3 u_c1;

/**
 * @label Rim B
 * @color
 * @default #B08CF5
 */
uniform vec3 u_c2;

/**
 * @label Rim C
 * @color
 * @default #7AD3E3
 */
uniform vec3 u_c3;

/**
 * @label Grain
 * @default 0.035
 * @range 0, 0.2
 */
uniform float u_grain;

float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float mark(vec2 p, float s) {
  float hs = 0.5 * s;
  float sq = sdBox(p, vec2(hs), 0.06 * s);
  float frame = abs(sq + 0.045 * s) - 0.045 * s;
  float disc = max(length(p - vec2(-hs, -hs)) - 0.7 * s, sq);
  return min(frame, disc);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 spectrum(float t) {
  t = fract(t);
  vec3 a = mix(u_c1, u_c2, smoothstep(0.0, 0.5, t));
  return mix(a, u_c3, smoothstep(0.5, 1.0, t));
}

void main() {
  vec2 res = u_resolution;
  vec2 p = gl_FragCoord.xy;
  float s = u_size * min(res.x, res.y);
  vec2 c = vec2(u_cx * res.x, u_cy * res.y);
  vec2 q = p - c;

  vec2 ld = vec2(cos(u_light), sin(u_light));
  float t = u_time * 0.08;

  // soft beam across the frame from the light direction
  float along = dot(q / s, ld);
  float across = dot(q / s, vec2(-ld.y, ld.x));
  float beam = u_beam * exp(-across * across * 1.6) * smoothstep(-0.6, 1.8, along) * 0.18;

  // cool halo behind the mark
  float r = length(q) / s;
  float halo = u_halo * exp(-r * r * 1.4);
  vec3 haloCol = spectrum(0.15 + 0.1 * sin(t)) * halo * 0.22;

  vec3 col = u_base + vec3(beam) * vec3(0.8, 0.85, 1.0) + haloCol;

  // the mark
  float d = mark(q, s);
  float e = 1.5;
  vec2 g = vec2(mark(q + vec2(e, 0.0), s) - mark(q - vec2(e, 0.0), s),
                mark(q + vec2(0.0, e), s) - mark(q - vec2(0.0, e), s));
  vec2 n = normalize(g + 1e-5);

  float inside = smoothstep(1.0, -1.0, d);
  float facing = max(dot(n, ld), 0.0);
  float rimBand = smoothstep(-7.0, 0.0, d) * smoothstep(1.5, -0.5, d);
  float hueT = atan(q.y, q.x) / 6.2831 + 0.5 + t;
  vec3 rimCol = spectrum(hueT);
  vec3 rim = rimCol * rimBand * (0.25 + pow(facing, 1.4) * u_rim);

  // glossy body: dark with a faint vertical sheen
  float sheen = 0.03 + 0.05 * smoothstep(-0.5, 0.5, dot(q / s, ld));
  vec3 body = vec3(sheen) * vec3(0.92, 0.95, 1.0);

  col = mix(col, body, inside) + rim;

  // subtle outer glow hugging the shape
  float og = exp(-max(d, 0.0) / (0.05 * s)) * (1.0 - inside);
  col += rimCol * og * 0.12;

  float v = distance(p / res, vec2(0.5));
  col *= 1.0 - 0.35 * smoothstep(0.45, 0.95, v);
  col += (hash(p + floor(u_time * 24.0)) - 0.5) * u_grain;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
