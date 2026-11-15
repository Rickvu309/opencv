import {
  layoutPhotoSchema,
  privatePhotoLayoutSchema,
} from "@workspace/domain/internal/paper-presentation"
import { layoutFixture } from "./layout-fixture.js"

export function photoFixture() {
  return layoutPhotoSchema.parse({
    id: "portrait",
    type: "photo",
    source: "file:00000000-0000-4000-8000-000000000001",
    width: 1440,
    height: 1800,
    crop: { top: 5000, right: 10000, bottom: 15000, left: 20000 },
    rotation: 30,
    shape: "rounded",
    placement: { kind: "wrap", side: "right" },
    spacing: { top: 60, right: 80, bottom: 100, left: 120 },
    alt: "Linh at work",
  })
}
export function photoLayoutFixture() {
  const doc = layoutFixture()
  return privatePhotoLayoutSchema.parse({
    ...doc,
    profile: "private-layout-2",
    flow: { ...doc.flow, children: [...doc.flow.children, photoFixture()] },
  })
}
