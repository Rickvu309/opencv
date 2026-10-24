import { D, L, MOTION, P, S, coilZ, foundation, k, screw } from "./scene.mjs"

const slab = (plan, z, height, tone, bevel = 0.45) =>
  S(k.slabOf(plan, z, height, P, 4, bevel), tone)
const line = (x0, y0, x1, y1, z, tone = "lo") =>
  L(k.lineOnTop([x0, y0], [x1, y1], z, P), tone)

export function buildPlotter(scene) {
  foundation(scene, "Paper", "plotter")
  scene.back(
    "cv-platen",
    slab({ x: -60, y: -2, w: 48, d: 30, r: 1 }, 0, 2.2, "hi", 0.3)
  )
  scene.back(
    "letter-platen",
    slab({ x: 8, y: -2, w: 48, d: 30, r: 1 }, 0, 2.2, "hi", 0.3)
  )
  ;[
    ["clip-0", -56, 24],
    ["clip-1", -18, 24],
    ["clip-2", 12, 24],
    ["clip-3", 50, 24],
  ].forEach(([name, x, y]) => {
    scene.back(name, slab({ x, y, w: 8, d: 3, r: 0.5 }, 2.2, 1.1, "mid", 0.2))
  })
  scene.back(
    "user-trace",
    line(-56, 5.2, -16, 5.2, 2.35, "mid"),
    ` data-trace="user" style="opacity:1"`
  )
  scene.back(
    "coach-trace",
    line(-56, 12.2, -16, 12.2, 2.35, "lo"),
    ` data-trace="coach" style="opacity:0.35"`
  )
  scene.back(
    "letter-trace",
    line(12, 7.2, 52, 7.2, 2.35, "mid"),
    ` data-trace="letter" style="opacity:0.28"`
  )
  scene.back(
    "rail-far",
    slab({ x: -64, y: -8, w: 128, d: 4, r: 0.8 }, 2.2, 2.6, "mid", 0.3)
  )
  scene.back(
    "rail-near",
    slab({ x: -64, y: 26, w: 128, d: 4, r: 0.8 }, 2.2, 2.6, "mid", 0.3)
  )
  ;[
    ["stop-0", -64, -8],
    ["stop-1", 60, -8],
    ["stop-2", -64, 26],
    ["stop-3", 60, 26],
  ].forEach(([name, x, y]) => {
    scene.back(name, slab({ x, y, w: 4, d: 4, r: 0.6 }, 4.8, 4, "lo", 0.3))
  })
  scene.back(
    "end-0",
    slab({ x: -70, y: -10, w: 6, d: 42, r: 1 }, 0, 10, "mid", 0.5)
  )
  scene.back(
    "end-1",
    slab({ x: 64, y: -10, w: 6, d: 42, r: 1 }, 0, 10, "mid", 0.5)
  )
  const strip = { x: -60, y: 34, w: 120, d: 5, r: 0.8 }
  const ticks = k.topTicks(
    strip.x + 4,
    strip.x + strip.w - 4,
    4,
    5,
    strip.y + 0.7,
    0.7,
    [1.6, 3],
    P
  )
  scene.back(
    "ruler",
    slab(strip, 0, 0.6, "lo", 0.15) +
      L(ticks.minor, "lo") +
      L(ticks.major, "mid")
  )
  scene.back(
    "drum",
    S(k.cylinder(-6, -30, 8, 0, 20, P, 16, 0.4), "mid") +
      L(k.sideArc(-6, -30, 8, 10, P, 14), "faint")
  )
  scene.back("drum-flange", S(k.cylinder(-6, -30, 10, 0, 2.2, P, 16), "lo"))
  scene.back("drum-pin", S(k.cylinder(-6, -30, 1.4, 20, 3, P, 10), "mid"))
  scene.back(
    "user-rib",
    slab({ x: -7.4, y: -38, w: 2.6, d: 8, r: 0.4 }, 6, 12, "hi", 0.2),
    ` data-trace="user" style="opacity:1"`
  )
  scene.back(
    "coach-rib",
    slab({ x: -1.2, y: -38, w: 2.6, d: 8, r: 0.4 }, 6, 12, "mid", 0.2),
    ` data-trace="coach" style="opacity:0.35"`
  )
  scene.back(
    "selector",
    slab({ x: -16, y: -36, w: 6, d: 10, r: 0.8 }, 8, 8, "mid", 0.3)
  )
  const origin = MOTION.plotterStops[0]
  const spring = coilZ(origin.x + 2, origin.y + 2, 16, 22, 2.2, 4)
  scene.move(
    "carriage",
    slab(
      { x: origin.x - 8, y: origin.y - 6, w: 16, d: 14, r: 1.4 },
      18,
      7,
      "mid",
      0.5
    ) +
      slab(
        { x: origin.x - 3, y: origin.y - 2, w: 6, d: 6, r: 0.8 },
        12,
        6,
        "mid",
        0.3
      ) +
      S(k.cylinder(origin.x, origin.y + 1, 1.15, 6, 6.5, P, 10), "hi", {
        lit: true,
      }) +
      S(k.cylinder(origin.x, origin.y + 1, 1.8, 11.6, 1.4, P, 10), "mid") +
      S(k.cylinder(origin.x + 5, origin.y + 4, 2.2, 20, 3.2, P, 12), "mid") +
      L(spring.back, "lo") +
      L(spring.front, "mid") +
      screw(origin.x - 4, origin.y - 2, 25.1) +
      screw(origin.x + 4, origin.y - 2, 25.1) +
      slab(
        { x: origin.x - 1, y: origin.y + 8, w: 2, d: 22, r: 0.4 },
        8,
        1.2,
        "hi",
        0.15
      ) +
      S(k.cylinder(origin.x - 6, origin.y - 4, 1.6, 22, 30, P, 8), "lo") +
      S(k.cylinder(origin.x + 6, origin.y - 4, 1.6, 22, 30, P, 8), "lo") +
      S(k.cylinder(origin.x - 6, origin.y + 6, 1.6, 22, 30, P, 8), "lo") +
      S(k.cylinder(origin.x + 6, origin.y + 6, 1.6, 22, 30, P, 8), "lo")
  )
  scene.names.add("holder")
  scene.names.add("nib")
  scene.names.add("cap")
  scene.names.add("lift-cam")
  scene.names.add("lift-spring")
  scene.names.add("clamp-0")
  scene.names.add("clamp-1")
  scene.names.add("pointer")
  scene.names.add("bushing-0")
  scene.names.add("bushing-1")
  scene.names.add("bushing-2")
  scene.names.add("bushing-3")
  scene.near(
    "riser-0",
    slab({ x: -68, y: 0, w: 6, d: 12, r: 1 }, 8, 44, "mid", 0.5)
  )
  scene.near(
    "riser-1",
    slab({ x: 60, y: 0, w: 6, d: 12, r: 1 }, 8, 44, "mid", 0.5)
  )
  scene.near(
    "beam",
    slab({ x: -66, y: 1, w: 130, d: 10, r: 1.5 }, 48, 6, "mid", 0.6)
  )
  scene.near(
    "belt",
    slab({ x: -60, y: 10, w: 118, d: 1.4, r: 0.3 }, 50, 2.2, "lo", 0.1)
  )
  scene.near(
    "return-lever",
    slab({ x: 46, y: 32, w: 18, d: 3.2, r: 0.8 }, 6, 3, "mid", 0.3)
  )
  scene.near(
    "knob",
    S(k.cylinder(66, 33.6, 2.8, 5, 6, P, 12), "mid") +
      L(k.knurl(66, 33.6, 2.8, 7, 11, 14, P), "lo")
  )
  scene.near("beam-screw-0", screw(-62, 6, 54.2))
  scene.near("beam-screw-1", screw(58, 6, 54.2))
}
