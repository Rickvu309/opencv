import { useEffect, useRef } from "react"

import { AUTH_COPY } from "./auth-copy.ts"
import fragmentSource from "./design/auth-quadrant-v2.glsl?raw"
import { authShaderFill } from "./auth-shader-fill.ts"

const VERT = `attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`

const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])

const FIXED_TIME = 0

function glContext(canvas: HTMLCanvasElement) {
  try {
    return canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
    })
  } catch {
    return null
  }
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function link(gl: WebGLRenderingContext, fragment: string) {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERT)
  const frag = compile(gl, gl.FRAGMENT_SHADER, fragment)
  if (!vertex || !frag) {
    if (vertex) gl.deleteShader(vertex)
    if (frag) gl.deleteShader(frag)
    return null
  }
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vertex)
  gl.attachShader(program, frag)
  gl.bindAttribLocation(program, 0, "a_position")
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(frag)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    return null
  }
  return program
}

function mountShader(canvas: HTMLCanvasElement) {
  const acquired = glContext(canvas)
  if (!acquired) return () => {}
  const gl: WebGLRenderingContext = acquired
  const program = link(gl, fragmentSource)
  if (!program) return () => {}

  const buffer = gl.createBuffer()
  if (!buffer) return () => {}
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.useProgram(program)

  const uniforms = authShaderFill.uniforms
  for (const [name, value] of Object.entries(uniforms)) {
    const location = gl.getUniformLocation(program, name)
    if (location) gl.uniform1f(location, value)
  }
  const resolution = gl.getUniformLocation(program, "u_resolution")
  const time = gl.getUniformLocation(program, "u_time")

  let raf = 0
  let stopped = false
  let onScreen = true
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
  let reduced = motion.matches

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = Math.round(canvas.clientWidth * dpr)
    const height = Math.round(canvas.clientHeight * dpr)
    if (width < 1 || height < 1) return false
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    gl.viewport(0, 0, canvas.width, canvas.height)
    if (resolution) gl.uniform2f(resolution, canvas.width, canvas.height)
    return true
  }

  function draw(seconds: number) {
    if (time) gl.uniform1f(time, seconds)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  function frame(now: number) {
    raf = 0
    if (stopped || reduced || document.hidden || !onScreen) return
    if (!resize()) return
    draw(now / 1000)
    raf = requestAnimationFrame(frame)
  }

  function startLoop() {
    if (stopped || reduced || raf || document.hidden || !onScreen) return
    raf = requestAnimationFrame(frame)
  }

  function drawStill() {
    if (stopped || !resize()) return
    draw(FIXED_TIME)
  }

  const onResize = () => {
    if (reduced) drawStill()
    else startLoop()
  }
  const resizeObserver =
    typeof ResizeObserver === "function" ? new ResizeObserver(onResize) : null
  resizeObserver?.observe(canvas)

  const onIntersect: IntersectionObserverCallback = (entries) => {
    onScreen = entries.some((entry) => entry.isIntersecting)
    if (onScreen && !reduced) startLoop()
    else stopLoop()
  }
  const intersection =
    typeof IntersectionObserver === "function"
      ? new IntersectionObserver(onIntersect)
      : null
  intersection?.observe(canvas)

  const onVisibility = () => {
    if (document.hidden || reduced) stopLoop()
    else startLoop()
  }
  document.addEventListener("visibilitychange", onVisibility)

  const onMotion = () => {
    reduced = motion.matches
    if (reduced) {
      stopLoop()
      drawStill()
      return
    }
    startLoop()
  }
  motion.addEventListener("change", onMotion)

  if (resize()) draw(reduced ? FIXED_TIME : performance.now() / 1000)
  if (!reduced) startLoop()

  return () => {
    stopped = true
    stopLoop()
    resizeObserver?.disconnect()
    intersection?.disconnect()
    document.removeEventListener("visibilitychange", onVisibility)
    motion.removeEventListener("change", onMotion)
    gl.deleteProgram(program)
    gl.deleteBuffer(buffer)
  }
}

export function AuthShaderPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fill = authShaderFill

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    return mountShader(canvas)
  }, [])

  return (
    <div
      data-pen-section="Right"
      className="grid min-h-dvh overflow-clip bg-foreground max-lg:hidden"
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        data-pen-fill={fill.url ? `shader:${fill.url}` : undefined}
        data-pen-uniforms={JSON.stringify(fill.uniforms)}
        className="col-start-1 row-start-1 h-full w-full"
      />
      <p className="mbs-[72px] col-start-1 row-start-1 ms-[72px] w-[min(520px,calc(100%-144px))] self-start justify-self-start text-[34px] leading-[1.15] font-semibold tracking-[-1.2px] text-white">
        {AUTH_COPY.hero1}
        <br />
        {AUTH_COPY.hero2}
      </p>
    </div>
  )
}
