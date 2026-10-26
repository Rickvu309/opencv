precision mediump float;

/** @resolution */
uniform vec2 u_resolution;

/** @content */
uniform sampler2D u_content;

/**
 * @label Lift
 * @default 0.45
 * @range 0, 1
 */
uniform float u_lift;

/**
 * @label Contrast
 * @default 1.1
 * @range 0.5, 2
 */
uniform float u_contrast;

/**
 * @label Grain
 * @default 0.03
 * @range 0, 0.2
 */
uniform float u_grain;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 src = texture2D(u_content, uv);
  float l = dot(src.rgb, vec3(0.299, 0.587, 0.114));
  l = clamp((l - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  l = mix(l, 1.0, u_lift);
  float v = distance(uv, vec2(0.5));
  l *= 1.0 - 0.12 * smoothstep(0.3, 0.8, v);
  l += (hash(gl_FragCoord.xy) - 0.5) * u_grain;
  gl_FragColor = vec4(vec3(clamp(l, 0.0, 1.0)) * src.a, src.a);
}
