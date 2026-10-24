import { D, L, MOTION, P, S, coilZ, foundation, k, screw } from "./scene.mjs"

const slab = (plan, z, height, tone, bevel = 0.45) =>
  S(k.slabOf(plan, z, height, P, 4, bevel), tone)
const bays = MOTION.dispatchBays

export function buildDispatch(scene) {
  foundation(scene, "Apply", "dispatch")
  scene.back(
    "floor-groove",
    L(
      k.planOutline({ x: -58, y: -24, w: 116, d: 46, r: 1 }, 0.25, P, 3),
      "faint"
    )
  )
  scene.back(
    "back-plate",
    slab({ x: -60, y: -30, w: 120, d: 5, r: 1 }, 0, 58, "mid", 0.6)
  )
  scene.back(
    "end-0",
    slab({ x: -60, y: -26, w: 6, d: 48, r: 1 }, 0, 52, "mid", 0.5)
  )
  scene.back(
    "end-1",
    slab({ x: 54, y: -26, w: 6, d: 48, r: 1 }, 0, 52, "mid", 0.5)
  )
  ;[-32, -9, 14, 37].forEach((x, index) => {
    scene.back(
      `divider-${index}`,
      slab({ x, y: -26, w: 4, d: 24, r: 0.6 }, 0, 46, "lo", 0.4)
    )
  })
  scene.back(
    "rail",
    slab({ x: -58, y: 16, w: 116, d: 5, r: 0.8 }, 6, 3.2, "mid", 0.35)
  )
  scene.back(
    "bracket-0",
    slab({ x: -58, y: 14, w: 5, d: 8, r: 0.6 }, 0, 6, "lo", 0.3)
  )
  scene.back(
    "bracket-1",
    slab({ x: 52, y: 14, w: 5, d: 8, r: 0.6 }, 0, 6, "lo", 0.3)
  )
  const strip = { x: -52, y: 28, w: 104, d: 4.5, r: 0.6 }
  const ticks = k.topTicks(-48, 48, 23, 1, strip.y + 0.5, 0.65, [1.4, 2.6], P)
  scene.back(
    "tick-strip",
    slab(strip, 0, 0.55, "lo", 0.15) +
      L(ticks.minor, "lo") +
      L(ticks.major, "mid")
  )
  bays.forEach((x, index) => {
    scene.back(`bay-dot-${index}`, D([k.iso([x, 30.2, 0.7], P)], 0.7))
  })
  scene.back(
    "index-wheel",
    S(k.cylinder(-64, 20, 5, 8, 3, P, 14, 0.3), "mid") +
      L(k.ring(-64, 20, 3.2, 11.1, P, 14), "lo")
  )
  scene.back("wheel-pin", S(k.cylinder(-64, 20, 1.1, 11, 2.2, P, 8), "hi"))
  scene.back(
    "detent",
    slab({ x: -52, y: 14, w: 4, d: 6, r: 0.5 }, 9.2, 3, "mid", 0.25)
  )
  scene.back("detent-screw", screw(-50, 17, 12.3))
  scene.back(
    "bumper-0",
    slab({ x: -54, y: 18, w: 3, d: 6, r: 0.5 }, 4, 5, "lo", 0.3)
  )
  scene.back(
    "bumper-1",
    slab({ x: 50, y: 18, w: 3, d: 6, r: 0.5 }, 4, 5, "lo", 0.3)
  )
  scene.back(
    "chute-outer",
    slab({ x: 66, y: -8, w: 4, d: 30, r: 0.7 }, 0, 14, "mid", 0.4)
  )
  scene.back(
    "chute-inner",
    slab({ x: 62, y: -10, w: 12, d: 4, r: 0.6 }, 0, 10, "mid", 0.35)
  )
  scene.back(
    "chute-lip",
    slab({ x: 64, y: 16, w: 10, d: 8, r: 0.8 }, 3, 2.4, "lo", 0.3)
  )
  scene.back(
    "return-floor",
    slab({ x: 60, y: 22, w: 14, d: 12, r: 1 }, 0, 1.3, "mid", 0.25)
  )
  scene.back("chute-screw", screw(70, 4, 14.2))
  const home = bays[0]
  const spring = coilZ(home - 8, 18, 8, 13, 1.8, 3.5)
  scene.move(
    "carriage",
    slab({ x: home - 8, y: 14, w: 16, d: 8, r: 1 }, 9.2, 4, "mid", 0.4) +
      S(k.cylinder(home - 5, 18, 1.5, 7, 5, P, 8), "lo") +
      S(k.cylinder(home + 5, 18, 1.5, 7, 5, P, 8), "lo") +
      S(
        k.slabOf(
          { x: home - 6, y: 3.2, w: 12, d: 2.6, r: 0.4 },
          12,
          24,
          P,
          3,
          0.3
        ),
        "hi",
        { lit: true }
      ) +
      slab({ x: home - 5, y: 3.2, w: 10, d: 1.6, r: 0.3 }, 30, 2, "mid", 0.2) +
      S(k.cylinder(home, 6, 0.7, 32, 6, P, 8), "mid") +
      slab({ x: home - 3.5, y: 4.5, w: 7, d: 0.8, r: 0.2 }, 37, 5, "hi", 0.15) +
      S(k.cylinder(home, 5.2, 1.1, 36.5, 1.6, P, 8), "lo") +
      slab({ x: home - 9, y: 20, w: 8, d: 2.4, r: 0.5 }, 10, 2.2, "mid", 0.2) +
      L(spring.back, "lo") +
      L(spring.front, "mid") +
      D([k.iso([home, 30.2, 1.3], P)], 0.8)
  )
  scene.names.add("bushing-0")
  scene.names.add("bushing-1")
  scene.names.add("puck")
  scene.names.add("clip")
  scene.names.add("flag-staff")
  scene.names.add("flag")
  scene.names.add("flag-pivot")
  scene.names.add("return-lever")
  scene.names.add("return-spring")
  scene.names.add("index-pointer")
  scene.near("end-bolt-0", screw(-57, -8, 52.2))
  scene.near("end-bolt-1", screw(57, -8, 52.2))
  scene.near("end-bolt-2", screw(-57, 8, 52.2))
  scene.near("end-bolt-3", screw(57, 8, 52.2))
}
