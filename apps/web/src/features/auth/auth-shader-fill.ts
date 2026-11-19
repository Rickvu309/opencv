type ShaderUniformMap = Record<string, number>

export type AuthShaderFill = {
  url: string
  uniforms: ShaderUniformMap
}

export const authShaderFill: AuthShaderFill = {
  url: "shaders/auth-quadrant-v2.glsl",
  uniforms: { u_size: 0.74, u_beam: 1, u_rim: 1.2, u_grain: 0.05 },
}
