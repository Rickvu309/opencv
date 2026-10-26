precision mediump float;

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/** @content */
uniform sampler2D u_content;

/**
 * @label Contrast
 * @default 1.25
 * @range 0.5, 2
 */
uniform float u_contrast;

/**
 * @label Darken top
 * @default 0.55
 * @range 0, 1
 */
uniform float u_topShade;

/**
 * @label Grain
 * @default 0.07
 * @range 0, 0.3
 */
uniform float u_grain;

/**
 * @label Glow
 * @default 0.18
 * @range 0, 0.6
 */
uniform float u_glow;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 src = texture2D(u_content, uv);
  float l = dot(src.rgb, vec3(0.299, 0.587, 0.114));
  l = clamp((l - 0.5) * u_contrast + 0.5, 0.0, 1.0);

  float top = smoothstep(0.35, 1.0, uv.y);
  l *= 1.0 - u_topShade * top;

  vec2 c = vec2(0.5 + 0.25 * sin(u_time * 0.15), 0.35 + 0.1 * cos(u_time * 0.11));
  float d = distance(uv * vec2(u_resolution.x / u_resolution.y, 1.0), c * vec2(u_resolution.x / u_resolution.y, 1.0));
  l += u_glow * exp(-d * d * 6.0);

  float v = distance(uv, vec2(0.5));
  l *= 1.0 - 0.45 * smoothstep(0.35, 0.85, v);

  l += (hash(gl_FragCoord.xy + floor(u_time * 24.0)) - 0.5) * u_grain;

  gl_FragColor = vec4(vec3(clamp(l, 0.0, 1.0)), src.a);
}
