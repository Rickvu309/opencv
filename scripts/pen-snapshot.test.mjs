import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

test("snapshot preserves instance identity and resolves nested visible overrides", () => {
  mkdirSync(join(homedir(), "tmp"), { recursive: true })
  const scratch = mkdtempSync(join(homedir(), "tmp", "pen-snapshot-test-"))
  try {
    const pen = join(scratch, "source.pen")
    const out = join(scratch, "snapshot.json")
    writeFileSync(
      pen,
      JSON.stringify({
        children: [
          {
            id: "label",
            type: "frame",
            children: [
              { id: "label-text", type: "text", content: "Replacement" },
            ],
          },
          {
            id: "panel",
            type: "frame",
            stroke: "#EDEDEF",
            strokeWidth: { bottom: 1 },
            children: [
              { id: "title", type: "text", content: "Default" },
              {
                id: "body",
                type: "frame",
                children: [{ id: "old", type: "text", content: "Old" }],
              },
            ],
          },
          {
            id: "shell",
            type: "frame",
            children: [
              { id: "left", type: "ref", ref: "panel", enabled: false },
              { id: "right", type: "ref", ref: "panel" },
              { id: "cycle", type: "ref", ref: "shell" },
            ],
          },
          {
            id: "screen",
            type: "ref",
            ref: "shell",
            name: "Screen",
            width: 1440,
            height: 900,
            descendants: {
              left: { enabled: true, name: "Visible panel" },
              "left/title": { content: "Tailored title" },
              "left/body": {
                children: [{ id: "replacement", type: "ref", ref: "label" }],
              },
              "right/body": { enabled: false },
            },
          },
        ],
      })
    )
    execFileSync(
      process.execPath,
      ["scripts/pen-snapshot.mjs", pen, "screen", out, "--styles"],
      { stdio: "pipe" }
    )
    const styles = JSON.parse(
      readFileSync(join(scratch, "snapshot.styles.json"), "utf8")
    )
    assert.deepEqual(styles.borders, [
      { id: "left", stroke: "#EDEDEF", strokeWidth: { bottom: 1 } },
      { id: "right", stroke: "#EDEDEF", strokeWidth: { bottom: 1 } },
    ])
    const snapshot = JSON.parse(readFileSync(out, "utf8"))
    assert.equal(snapshot.source.frameId, "screen")
    assert.deepEqual(
      snapshot.sections.map(({ id, texts }) => ({ id, texts })),
      [
        { id: "left", texts: ["Tailored title", "Replacement"] },
        { id: "right", texts: ["Default"] },
      ]
    )
    execFileSync(
      process.execPath,
      ["scripts/pen-snapshot.mjs", pen, "screen", out, "--root", "left"],
      { stdio: "pipe" }
    )
    const rooted = JSON.parse(readFileSync(out, "utf8"))
    assert.equal(rooted.source.root, "left")
    assert.deepEqual(
      rooted.sections.flatMap(({ texts }) => texts),
      ["Tailored title", "Replacement"]
    )
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})

test("paint provenance distinguishes repeated instances and preserves visible source values", () => {
  mkdirSync(join(homedir(), "tmp"), { recursive: true })
  const scratch = mkdtempSync(join(homedir(), "tmp", "pen-paints-test-"))
  try {
    const pen = join(scratch, "source.pen")
    const out = join(scratch, "snapshot.json")
    writeFileSync(
      pen,
      JSON.stringify({
        variables: { surface: { value: "#FAFAFA00" } },
        children: [
          { id: "unused", type: "frame", fill: "#123456" },
          {
            id: "component",
            type: "frame",
            fill: "#111111",
            children: [
              { id: "icon", type: "icon", fill: "#3C3C40" },
              { id: "hidden", type: "frame", enabled: false, fill: "#DEAD00" },
              {
                id: "gradient",
                type: "frame",
                fill: {
                  type: "gradient",
                  colors: [
                    { color: "$surface", position: 0 },
                    { color: "#FFFFFF", position: 1 },
                    { color: "#BADBAD", enabled: false, position: 0.5 },
                  ],
                },
                effect: [
                  { type: "shadow", color: "#00000008" },
                  { type: "shadow", enabled: false, color: "#BAD000" },
                ],
              },
            ],
          },
          {
            id: "screen",
            type: "frame",
            children: [
              {
                id: "instance",
                type: "ref",
                ref: "component",
                descendants: { icon: { fill: "#59595B" } },
              },
              {
                id: "second-instance",
                type: "ref",
                ref: "component",
                descendants: { icon: { fill: "#8A8A8E" } },
              },
            ],
          },
        ],
      })
    )
    execFileSync(
      process.execPath,
      ["scripts/pen-snapshot.mjs", pen, "screen", out, "--styles"],
      { stdio: "pipe" }
    )
    const { paints } = JSON.parse(
      readFileSync(join(scratch, "snapshot.styles.json"), "utf8")
    )
    assert.deepEqual(
      paints.filter(({ id }) => id === "icon"),
      [
        { id: "icon", path: "/children/0/children/0", fill: "#59595B" },
        { id: "icon", path: "/children/1/children/0", fill: "#8A8A8E" },
      ]
    )
    assert.equal(new Set(paints.map(({ path }) => path)).size, paints.length)
    assert.deepEqual(
      paints.find(({ id }) => id === "gradient"),
      {
        id: "gradient",
        path: "/children/0/children/1",
        fill: {
          type: "gradient",
          colors: [
            { color: "#FAFAFA00", position: 0 },
            { color: "#FFFFFF", position: 1 },
          ],
        },
        effect: [{ type: "shadow", color: "#00000008" }],
      }
    )
    assert.equal(
      paints.some(({ id }) => id === "hidden" || id === "unused"),
      false
    )
    assert.equal(paints[0].fill, "#111111")
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})
