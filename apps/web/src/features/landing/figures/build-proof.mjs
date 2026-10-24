import { D, L, MOTION, P, S, coilZ, foundation, k, screw } from "./scene.mjs"

const slab = (plan, z, height, tone, bevel = 0.5) =>
  S(k.slabOf(plan, z, height, P, 4, bevel), tone)

export function buildProof(scene) {
  foundation(scene, "Proof", "proof")
  scene.back(
    "pad-0",
    slab({ x: -22, y: -6, w: 16, d: 12, r: 1 }, 0, 1.2, "lo", 0.3)
  )
  scene.back(
    "pad-1",
    slab({ x: 6, y: -6, w: 16, d: 12, r: 1 }, 0, 1.2, "lo", 0.3)
  )
  scene.back(
    "drawer",
    slab({ x: -68, y: 16, w: 18, d: 16, r: 1 }, 0, 7, "mid", 0.5)
  )
  scene.back(
    "pull",
    slab({ x: -62, y: 31, w: 8, d: 2.2, r: 0.6 }, 2.2, 2.4, "mid", 0.2) +
      S(k.cylinder(-60, 33.2, 1.3, 2, 3, P, 10), "mid") +
      S(k.cylinder(-54, 33.2, 1.3, 2, 3, P, 10), "mid")
  )
  scene.back("drawer-screw", screw(-58, 24, 7.2))
  scene.back(
    "anvil",
    slab({ x: -26, y: -8, w: 52, d: 32, r: 1.4 }, 0, 5, "mid", 0.6)
  )
  scene.back(
    "sheet",
    slab({ x: -18, y: -1, w: 36, d: 20, r: 0.4 }, 5, 0.5, "hi", 0.15)
  )
  scene.back(
    "sheet-clip",
    slab({ x: -8, y: -2.5, w: 16, d: 2.2, r: 0.4 }, 5.5, 1.1, "mid", 0.2)
  )
  scene.back(
    "back-plate",
    slab({ x: -34, y: -20, w: 68, d: 6, r: 1 }, 4, 40, "mid", 0.5)
  )
  scene.back(
    "throat",
    slab({ x: -18, y: -16, w: 36, d: 8, r: 1 }, 22, 6, "lo", 0.4)
  )
  for (const [name, x] of [
    ["post-0", -30],
    ["post-1", 30],
  ]) {
    scene.back(
      name,
      S(k.cylinder(x, -2, 3.3, 0, 50, P, 14), "mid", { crease: "none" }) +
        L(k.sideArc(x, -2, 3.3, 16, P, 12), "faint") +
        L(k.sideArc(x, -2, 3.3, 34, P, 12), "faint")
    )
  }
  for (const [name, x] of [
    ["guide-0", -12],
    ["guide-1", 12],
  ]) {
    scene.back(
      name,
      S(k.cylinder(x, 6, 1.25, 5, 45, P, 10), "mid", { crease: "none" })
    )
  }
  scene.back(
    "roller",
    slab({ x: 20, y: 8, w: 16, d: 6, r: 3 }, 8, 6, "mid", 0.4)
  )
  scene.back(
    "axle",
    S(k.cylinder(20, 11, 1, 7.2, 7.6, P, 10), "lo") +
      S(k.cylinder(36, 11, 1, 7.2, 7.6, P, 10), "lo")
  )
  const pins = [-14, 0, 14]
  pins.forEach((x, index) => {
    scene.back(
      `seat-${index}`,
      slab({ x: x - 3.2, y: 26, w: 6.4, d: 8, r: 0.8 }, 0, 2.6, "lo", 0.3)
    )
    scene.back(
      `collar-${index}`,
      S(k.cylinder(x, 30, 2.1, 2.6, 1.5, P, 12), "mid")
    )
    const spring = coilZ(x, 30, 4.1, 9, 2.05, 4)
    scene.back(`spring-${index}`, L(spring.back, "lo") + L(spring.front, "mid"))
    scene.move(
      `pin-${index}`,
      S(k.cylinder(x, 30, 1.15, 9, 8, P, 10), "hi", { crease: "none" }) +
        S(k.cylinder(x, 30, 1.7, 16.2, 1.3, P, 10), "mid")
    )
  })
  const coil = coilZ(0, 6, 44, 50, 4.2, 5)
  scene.back("coil-back", L(coil.back, "lo"))
  scene.move(
    "platen",
    S(k.cylinder(0, 6, 2.15, 41, 33, P, 12), "mid", { crease: "none" }) +
      slab({ x: -16, y: -2, w: 32, d: 18, r: 1.3 }, 36, 5, "mid", 0.6) +
      S(
        k.slabOf({ x: -7, y: 2, w: 14, d: 10, r: 0.6 }, 30, 6, P, 3, 0.4),
        "hi",
        { lit: true }
      ) +
      screw(-4, 5, 36.2) +
      screw(4, 5, 36.2) +
      screw(-4, 9, 36.2) +
      screw(4, 9, 36.2) +
      S(k.cylinder(-12, 6, 2.4, 34, 6, P, 10), "lo") +
      S(k.cylinder(12, 6, 2.4, 34, 6, P, 10), "lo")
  )
  scene.names.add("die")
  scene.names.add("die-screw-0")
  scene.names.add("die-screw-1")
  scene.names.add("die-screw-2")
  scene.names.add("die-screw-3")
  scene.names.add("ram")
  scene.names.add("bushing-0")
  scene.names.add("bushing-1")
  scene.cover("coil-front", L(coil.front, "mid"))
  scene.cover(
    "gland",
    slab({ x: -10, y: 1, w: 20, d: 10, r: 1 }, 46, 4, "mid", 0.4)
  )
  scene.cover(
    "head",
    slab({ x: -38, y: -8, w: 76, d: 18, r: 2 }, 50, 8, "mid", 0.8)
  )
  scene.cover(
    "bolt-0",
    S(k.cylinder(-30, -2, 2.3, 58, 2.2, P, 12), "mid") + screw(-30, -2, 60.3)
  )
  scene.cover(
    "bolt-1",
    S(k.cylinder(30, -2, 2.3, 58, 2.2, P, 12), "mid") + screw(30, -2, 60.3)
  )
  scene.near(
    "fence-0",
    slab({ x: -28, y: 24, w: 4, d: 14, r: 0.7 }, 0, 14, "mid", 0.4)
  )
  scene.near(
    "fence-1",
    slab({ x: 24, y: 24, w: 4, d: 14, r: 0.7 }, 0, 14, "mid", 0.4)
  )
  scene.near(
    "lever",
    slab({ x: 40, y: -2, w: 22, d: 4, r: 1.2 }, 44, 3.4, "mid", 0.4)
  )
  scene.near("lever-screw", screw(42, 0, 47.5))
  scene.near(
    "knob",
    S(k.cylinder(62, 0, 3.3, 42.5, 7, P, 14), "mid") +
      L(k.knurl(62, 0, 3.3, 45, 49.5, 16, P), "lo")
  )
  scene.near("index", D([k.iso([62, 0, 49.7], P)], 0.55))
  if (MOTION.platenDrop !== 24) throw new Error("proof drop drifted")
}
