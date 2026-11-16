import { afterEach, describe, expect, it } from "vitest"
import {
  canonical,
  photoBounds,
  type Result,
} from "@workspace/domain/internal/paper-presentation"
import {
  createPrivateLayout,
  readLayout,
  commitLayoutPhotoEdit,
  type LayoutBinding,
} from "./native-layout.js"
import { mountPrivateLayout } from "./native-layout-mount.js"
import { photoFixture, photoLayoutFixture } from "./test/photo-fixture.js"

const bindings = new Set<LayoutBinding>(),
  mounts = new Set<ReturnType<typeof mountPrivateLayout>>(),
  hosts = new Set<HTMLElement>()
afterEach(() => {
  for (const mount of mounts) mount.unmount()
  for (const binding of bindings) {
    binding.engine._tiptapEditor.destroy()
    binding.doc.destroy()
  }
  for (const host of hosts) host.remove()
  mounts.clear()
  bindings.clear()
  hosts.clear()
})
function value<T>(result: Result<T>): T {
  if (result.kind === "refused") throw new Error(result.reason)
  return result.value
}
function setup() {
  const binding = value(createPrivateLayout(photoLayoutFixture())),
    host = document.createElement("div")
  document.body.append(host)
  bindings.add(binding)
  hosts.add(host)
  const mount = mountPrivateLayout(
    binding,
    host,
    (source) => `/owned/${source.slice(5)}`
  )
  mounts.add(mount)
  return { binding, host, mount }
}
describe("mounted photo geometry on the owned fragment", () => {
  it("renders owned source, crop, rounded shape, rotated frame and wrapping bounds", () => {
    const { host } = setup(),
      photo = photoFixture(),
      bounds = photoBounds(photo)
    const figure = host.querySelector<HTMLElement>(
        "[data-paper-photo='portrait']"
      ),
      frame = figure?.firstElementChild,
      image = figure?.querySelector("img")
    expect(figure?.style.width).toBe(
      `${(bounds.width + photo.spacing.left + photo.spacing.right) / 20}pt`
    )
    expect(figure?.style.cssFloat).toBe("right")
    expect(frame instanceof HTMLElement && frame.style.transform).toBe(
      "rotate(30deg)"
    )
    const radii =
      frame instanceof HTMLElement
        ? frame.style.borderRadius.split(" / ").map(Number.parseFloat)
        : []
    expect(radii[0]).toBeCloseTo(100 / 6)
    expect(radii[1]).toBeCloseTo((1440 / (6 * 1800)) * 100)
    expect(image?.getAttribute("src")).toBe(
      "/owned/00000000-0000-4000-8000-000000000001"
    )
    expect(image?.alt).toBe("Linh at work")
    expect(image?.style.width).toBe(`${10000000 / 70000}%`)
  })
  it("keeps the photo, rotated bounds and spacing proportional inside a narrow column without changing saved geometry", () => {
    const { binding, host } = setup(),
      before = canonical(readLayout(binding)),
      photo = photoFixture(),
      bounds = photoBounds(photo),
      width = bounds.width + photo.spacing.left + photo.spacing.right,
      height = bounds.height + photo.spacing.top + photo.spacing.bottom,
      figure = host.querySelector<HTMLElement>("[data-paper-photo='portrait']"),
      outer = figure?.closest<HTMLElement>("[data-paper-photo-placement]"),
      frame = figure?.querySelector("div")
    expect(outer?.style.maxWidth).toBe("100%")
    expect(figure?.style.maxWidth).toBe("100%")
    expect(figure?.style.height).toBe("auto")
    expect(figure?.style.aspectRatio).toBe(`${width} / ${height}`)
    expect(frame?.style.width).toBe(`${(photo.width / width) * 100}%`)
    expect(frame?.style.height).toBe(`${(photo.height / height) * 100}%`)
    expect(frame?.style.left).toBe(
      `${(((bounds.width - photo.width) / 2 + photo.spacing.left) / width) * 100}%`
    )
    expect(frame?.style.top).toBe(
      `${(((bounds.height - photo.height) / 2 + photo.spacing.top) / height) * 100}%`
    )
    expect(canonical(readLayout(binding))).toBe(before)
  })
  it("updates the mounted photo from a durable command and rejects direct unreceipted mutation", () => {
    const { binding, host, mount } = setup()
    value(
      commitLayoutPhotoEdit(
        binding,
        "circle",
        {
          kind: "update-photo",
          photo: {
            ...photoFixture(),
            width: 1440,
            height: 1440,
            shape: "circle",
            rotation: 0,
          },
        },
        canonical(readLayout(binding))
      )
    )
    expect(
      host.querySelector<HTMLElement>("[data-paper-photo='portrait'] > div")
        ?.style.borderRadius
    ).toBe("50%")
    const before = readLayout(binding)
    mount.editor.updateBlock("portrait", {
      props: { photo: canonical({ ...photoFixture(), alt: "Unreceipted" }) },
    })
    expect(readLayout(binding)).toEqual(before)
  })
})
