precision mediump float;

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/**
 * @label Mark size
 * @default 0.74
 * @range 0.3, 1.2
 */
uniform float u_size;

/**
 * @label Beam strength
 * @default 1.0
 * @range 0, 2
 */
uniform float u_beam;

/**
 * @label Rim light
 * @default 1.2
 * @range 0, 3
 */
uniform float u_rim;

/**
 * @label Grain
 * @default 0.05
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

void main() {
  vec2 res = u_resolution;
  vec2 p = gl_FragCoord.xy;
  float s = u_size * min(res.x, res.y);
  vec2 c = vec2(0.5 * res.x, 0.44 * res.y);
  vec2 q = p - c;

  vec2 L = vec2(res.x * 1.08, res.y * (0.6 + 0.04 * sin(u_time * 0.25)));
  vec2 toL = L - p;
  float dist = length(toL);
  vec2 ld = toL / dist;
  float ang = atan(toL.y, toL.x);
  float ak = ang * 2.2; float cone = exp(-ak * ak);
  float fall = exp(-dist / (res.x * 0.9));
  float beam = u_beam * cone * fall;

  float bg = 0.018 + 0.9 * beam;
  float v = distance(p / res, vec2(0.6, 0.55));
  bg *= 1.0 - 0.5 * smoothstep(0.3, 0.95, v);

  float d = mark(q, s);
  float e = 1.5;
  vec2 g = vec2(mark(q + vec2(e, 0.0), s) - mark(q - vec2(e, 0.0), s),
                mark(q + vec2(0.0, e), s) - mark(q - vec2(0.0, e), s));
  vec2 n = normalize(g + 1e-5);

  float inside = smoothstep(1.0, -1.0, d);
  float surface = 0.045 + 0.22 * beam;
  float rimBand = smoothstep(-6.0, 0.0, d) * smoothstep(1.5, -0.5, d);
  float rim = rimBand * pow(max(dot(n, ld), 0.0), 1.6) * u_rim * (0.35 + 1.4 * fall);
  float shadow = smoothstep(0.0, 60.0, d) * 0.0 + (1.0 - smoothstep(0.0, 40.0, d)) * 0.35 * beam;

  float l = mix(bg - shadow, surface, inside) + rim;
  l += (hash(p + floor(u_time * 24.0)) - 0.5) * u_grain;

  vec3 col = vec3(l) * vec3(0.97, 0.98, 1.0);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
