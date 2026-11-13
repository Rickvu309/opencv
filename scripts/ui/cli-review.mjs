import { dirname, relative, resolve } from "node:path"
import { UsageError } from "./args.mjs"
import { compositeFiles, SPLIT_ABOVE } from "./annotate-split.mjs"
import {
  ARROWS_PER_IMAGE,
  CHANGES_PER_SCREEN,
  draftSpec,
  rankChanges,
} from "./changes.mjs"
import { readSpec, renderComposite } from "./composite.mjs"
import { diffImages } from "./diff.mjs"
import { readManifest } from "./manifest-file.mjs"
import {
  attachUrls,
  checkSummary,
  linksFromShot,
  picturesToUpload,
  renderPrSection,
} from "./pr-section.mjs"
import { ZOOM } from "./zoom.mjs"
import { EXIT, json, runUi, withBrowser } from "./cli.mjs"

export const REVIEW_COMMANDS = {
  changes: {
    usage: "changes <screen...> [--manifest file] [--spec out.json]",
    about: `List up to ${CHANGES_PER_SCREEN} elements per screen whose box or style differs between before and after, largest first, with a draft note. --spec writes a ready annotate spec: the ${ARROWS_PER_IMAGE} largest findings per image (changed, new or removed elements) as red numbered arrows, the rest as legend text under also.`,
    options: { valued: ["manifest", "spec"] },
    run: async (ctx, { positional, flags }) => {
      const { file, manifest } = readManifest(ctx, flags.manifest)
      const wanted = new Set(positional)
      const ranked = manifest.captures
        .filter((capture) => !wanted.size || wanted.has(capture.screen))
        .filter(
          (capture) => capture.before?.elements && capture.after?.elements
        )
        .map((capture) => ({
          capture,
          result: rankChanges(capture.before.elements, capture.after.elements),
        }))
      if (ranked.length === 0)
        throw new UsageError(
          "no screen in the manifest has both sides captured; check compare's problems"
        )
      const lines = ranked.map(({ capture, result }) =>
        json({ screen: capture.screen, width: capture.width, ...result })
      )
      if (flags.spec) {
        const specFile = resolve(flags.spec)
        const spec = draftSpec(ranked, {
          manifestPath: relative(dirname(specFile), file),
        })
        ctx.fs.write(specFile, JSON.stringify(spec, null, 2))
        lines.push(json({ spec: specFile }))
      }
      return { code: EXIT.ok, lines }
    },
  },
  annotate: {
    usage: "annotate --spec <file.json> --out <png or dir> [--single]",
    about: `Render dark composites: per section a title, the before and after images (or one image for a section with image or side), red arrows with a numbered red badge pointing at the same target in both, and a legend in the same badges with ${ZOOM.factor}x before and after crops for small changes. A target named on one side only is tagged new or removed and marked at its place on the other side. A spec with more than ${SPLIT_ABOVE} sections writes one composite per section named from its title, unless --single.`,
    options: { valued: ["spec", "out"], switches: ["single"] },
    run: async (ctx, { flags }) => {
      if (!flags.spec || !flags.out)
        throw new UsageError("give --spec <file.json> and --out <png>")
      const specFile = resolve(flags.spec)
      const { spec } = readSpec(ctx, specFile)
      const files = compositeFiles(spec.sections, resolve(flags.out), {
        single: flags.single === true,
      })
      const lines = []
      let bad = false
      for (const file of files) {
        ctx.fs.mkdir(dirname(file.out))
        const sections = await renderComposite(
          ctx,
          specFile,
          file.out,
          file.sections
        )
        bad ||= sections.some((section) =>
          Object.values(section.missing).some((list) => list.length)
        )
        lines.push(...sections.map(json), json({ out: file.out }))
      }
      return { code: bad ? EXIT.failed : EXIT.ok, lines }
    },
  },
  "pr-section": {
    usage:
      "pr-section --annotated <png,...> [--manifest file] [--check] [--pr n | --issue n]",
    about:
      "Upload the composite and every before and after through scripts/ocv-tools.mjs shot (no comment) and print the ## Before / after markdown: every composite in the order given, a | main | this PR | table and, with --check, the check summary per screen.",
    options: {
      valued: ["manifest", "pr", "issue"],
      repeated: ["annotated"],
      switches: ["check"],
    },
    run: async (ctx, { flags }) => {
      if (!flags.annotated) throw new UsageError("give --annotated <png>")
      const { file, manifest } = readManifest(ctx, flags.manifest)
      const pictures = picturesToUpload(
        manifest,
        flags.annotated.map((file) => resolve(file))
      ).map((picture) => ({
        ...picture,
        file: resolve(dirname(file), picture.file),
      }))
      const checks = []
      if (flags.check)
        for (const screen of [
          ...new Set(manifest.captures.map((capture) => capture.screen)),
        ])
          checks.push(
            checkSummary(
              screen,
              await runUi(
                [
                  "check",
                  screen,
                  ...(manifest.baseChecks ? ["--known", file] : []),
                ],
                ctx
              )
            )
          )
      const target = {
        "--no-comment": true,
        ...(flags.pr ? { "--pr": flags.pr } : {}),
        ...(flags.issue ? { "--issue": flags.issue } : {}),
      }
      const shotLines = await ctx.upload(
        pictures.map((picture) => picture.file),
        target
      )
      const uploaded = attachUrls(pictures, linksFromShot(shotLines))
      return {
        code: EXIT.ok,
        lines: [renderPrSection({ manifest, uploaded, checks })],
      }
    },
  },
  diff: {
    usage: "diff <before.png> <after.png> [--out file]",
    about:
      "Count differing pixels and write a diff image (changed pixels in red).",
    options: { valued: ["out"] },
    run: async (ctx, { positional, flags }) => {
      const [before, after] = positional
      if (!before || !after)
        throw new UsageError("give a before and an after PNG")
      const dataUrl = (path) =>
        `data:image/png;base64,${ctx.fs.readBytes(path).toString("base64")}`
      const result = await withBrowser(ctx, (browser) =>
        diffImages(browser, dataUrl(before), dataUrl(after))
      )
      const out = resolve(
        flags.out ?? after.replace(/\.png$/i, "") + ".diff.png"
      )
      ctx.fs.write(out, Buffer.from(result.png, "base64"))
      return {
        code: result.different === 0 ? EXIT.ok : EXIT.failed,
        lines: [
          json({
            before: result.before,
            after: result.after,
            different: result.different,
            total: result.total,
            diff: out,
          }),
        ],
      }
    },
  },
}
