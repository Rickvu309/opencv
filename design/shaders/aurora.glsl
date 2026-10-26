precision mediump float;

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/**
 * @label Base
 * @color
 * @default #0B0C14
 */
uniform vec3 u_base;

/**
 * @label Glow A
 * @color
 * @default #8EA4E0
 */
uniform vec3 u_c1;

/**
 * @label Glow B
 * @color
 * @default #A79FDD
 */
uniform vec3 u_c2;

/**
 * @label Glow C
 * @color
 * @default #93C4CF
 */
uniform vec3 u_c3;

/**
 * @label Intensity
 * @default 0.9
 * @range 0, 2
 */
uniform float u_intensity;

/**
 * @label Scale
 * @default 1.6
 * @range 0.5, 4
 */
uniform float u_scale;

/**
 * @label Seed
 * @default 3.0
 * @range 0, 20
 */
uniform float u_seed;

/**
 * @label Grain
 * @default 0.06
 * @range 0, 0.3
 */
uniform float u_grain;

/**
 * @label Glow center X
 * @default 0.65
 * @range 0, 1
 */
uniform float u_cx;

/**
 * @label Glow center Y
 * @default 0.4
 * @range 0, 1
 */
uniform float u_cy;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    amp *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y) * u_scale + u_seed;
  float t = u_time * 0.04;

  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 0.6), fbm(p + 3.0 * q + vec2(8.3, 2.8) - t * 0.4));
  float f = fbm(p + 2.5 * r);

  vec2 c = vec2(u_cx * aspect, u_cy);
  float d = distance(vec2(uv.x * aspect, uv.y), c);
  float halo = exp(-d * d * 2.2);

  vec3 glow = mix(u_c1, u_c2, clamp(q.x * 1.4, 0.0, 1.0));
  glow = mix(glow, u_c3, clamp(r.y * r.y * 1.6, 0.0, 1.0));

  float mask = smoothstep(0.2, 0.9, f);
  vec3 col = u_base;
  col += glow * mask * (0.12 + 0.9 * halo) * u_intensity;
  col += glow * pow(halo, 3.0) * 0.45 * u_intensity;

  float v = distance(uv, vec2(0.5));
  col *= 1.0 - 0.35 * smoothstep(0.45, 0.95, v);

  col += (hash(gl_FragCoord.xy + floor(u_time * 24.0)) - 0.5) * u_grain;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
