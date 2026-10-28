import snapshot from "./design/auth.snapshot.json"

type ShaderUniformMap = Record<string, number>

export type AuthShaderFill = {
  url: string
  uniforms: ShaderUniformMap
}

type SnapshotFill = {
  type?: string
  url?: string
  uniforms?: ShaderUniformMap
}

const sections = snapshot.sections as readonly {
  fills?: readonly SnapshotFill[]
}[]

function readShaderFill(): AuthShaderFill {
  for (const section of sections) {
    for (const fill of section.fills ?? []) {
      if (fill.type !== "shader" || typeof fill.url !== "string") continue
      const uniforms: ShaderUniformMap = {}
      for (const [name, value] of Object.entries(fill.uniforms ?? {})) {
        if (typeof value === "number") uniforms[name] = value
      }
      return { url: fill.url, uniforms }
    }
  }
  return { url: "", uniforms: {} }
}

// The pen snapshot is the only place these numbers live.
export const authShaderFill = readShaderFill()
