#!/usr/bin/env node
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

export function frameEvidenceSha256(frame, base) {
  const artifact = (ref) => [resolve(base, ref?.path ?? ""), ref?.sha256]
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: frame.id,
        referenceKind: frame.reference?.kind,
        reference: artifact(frame.reference),
        actual: artifact(frame.actual),
        comparison: artifact(frame.comparison),
        source: (frame.source ?? [])
          .map(artifact)
          .sort((a, b) => a[0].localeCompare(b[0])),
      })
    )
    .digest("hex")
}

export function auditFrameAcceptance(release, manifest, base) {
  const expected = release.frames.filter((frame) => /^W\d/.test(frame.name))
  const failures = []
  if (!expected.length)
    failures.push("release inventory contains no app frames")
  const records = Array.isArray(manifest.frames) ? manifest.frames : []
  const seen = new Set()
  const verified = (ref, label) => {
    if (
      !ref ||
      typeof ref.path !== "string" ||
      !/^[a-f0-9]{64}$/.test(ref.sha256)
    ) {
      failures.push(`${label}: missing hashed artifact`)
      return null
    }
    try {
      const bytes = readFileSync(resolve(base, ref.path))
      if (createHash("sha256").update(bytes).digest("hex") !== ref.sha256) {
        failures.push(`${label}: stale artifact hash`)
        return null
      }
      return bytes
    } catch {
      failures.push(`${label}: unreadable artifact`)
      return null
    }
  }
  const known = new Set(expected.map((frame) => frame.id))
  for (const frame of records) {
    const label = frame.id
    if (!known.has(label)) failures.push(`${label}: unknown app frame`)
    if (seen.has(label)) failures.push(`${label}: duplicate frame`)
    seen.add(label)
    const comparisonBytes = verified(frame.comparison, `${label} comparison`)
    const reference = verified(frame.reference, `${label} reference`)
    const actual = verified(frame.actual, `${label} screenshot`)
    if (
      !["provided-photo", "native-pen-export"].includes(frame.reference?.kind)
    )
      failures.push(`${label}: original photo or native pen reference required`)
    if (!Array.isArray(frame.source) || !frame.source.length)
      failures.push(`${label}: missing current source hashes`)
    for (const source of frame.source ?? []) verified(source, `${label} source`)
    if (comparisonBytes) {
      try {
        const comparison = JSON.parse(comparisonBytes)
        for (const [bytes, size, kind] of [
          [reference, comparison.referenceSize, "reference"],
          [actual, comparison.actualSize, "screenshot"],
        ]) {
          if (
            !bytes ||
            bytes.length < 33 ||
            !bytes
              .subarray(0, 8)
              .equals(Buffer.from("89504e470d0a1a0a", "hex")) ||
            bytes.toString("ascii", 12, 16) !== "IHDR" ||
            bytes.readUInt32BE(8) !== 13 ||
            bytes.readUInt32BE(16) !== size?.[0] ||
            bytes.readUInt32BE(20) !== size?.[1]
          )
            failures.push(`${label}: ${kind} PNG header/dimensions differ`)
        }
        if (
          comparison.inputHashes?.reference !== frame.reference?.sha256 ||
          comparison.inputHashes?.actual !== frame.actual?.sha256
        )
          failures.push(
            `${label}: comparison input hashes differ or are missing`
          )
        if (
          comparison.minimum !== 95 ||
          comparison.target !== 97 ||
          comparison.tolerance !== 24
        )
          failures.push(`${label}: comparison policy changed`)
        if (
          JSON.stringify(comparison.referenceSize) !==
          JSON.stringify(comparison.actualSize)
        )
          failures.push(`${label}: reference was resized`)
        if (
          !Array.isArray(comparison.referenceSize) ||
          comparison.referenceSize.length !== 2 ||
          !comparison.referenceSize.every(
            (n) => Number.isSafeInteger(n) && n > 0
          )
        )
          failures.push(`${label}: invalid viewport`)
        const regions = Array.isArray(comparison.regions)
          ? comparison.regions
          : []
        if (!Array.isArray(comparison.regions))
          failures.push(`${label}: comparison regions must be an array`)
        if (
          !Array.isArray(regions) ||
          !regions.some((region) => region.name === "whole-frame")
        )
          failures.push(`${label}: missing whole-frame measurement`)
        if (
          !Array.isArray(regions) ||
          !regions.some(
            (region) =>
              typeof region.name === "string" &&
              region.name.trim() &&
              region.name !== "whole-frame"
          )
        )
          failures.push(`${label}: missing named detail region`)
        const regionNames = new Set()
        for (const region of regions ?? []) {
          if (
            typeof region.name !== "string" ||
            !region.name.trim() ||
            regionNames.has(region.name)
          )
            failures.push(
              `${label}: region names must be distinct nonempty strings`
            )
          regionNames.add(region.name)
          if (
            ![region.x, region.y, region.width, region.height].every(
              Number.isSafeInteger
            ) ||
            region.x < 0 ||
            region.y < 0 ||
            region.width <= 0 ||
            region.height <= 0 ||
            region.x + region.width > comparison.referenceSize?.[0] ||
            region.y + region.height > comparison.referenceSize?.[1] ||
            !Number.isSafeInteger(region.pixels) ||
            region.pixels !== region.width * region.height
          )
            failures.push(
              `${label}/${region.name}: invalid region bounds or pixel count`
            )

          if (
            !Number.isFinite(region.matchPercent) ||
            region.matchPercent < 95 ||
            region.matchPercent > 100
          )
            failures.push(
              `${label}/${region.name}: pixel match below 95 or missing`
            )
          if (
            region.name === "whole-frame" &&
            (region.x !== 0 ||
              region.y !== 0 ||
              region.width !== comparison.referenceSize?.[0] ||
              region.height !== comparison.referenceSize?.[1] ||
              region.pixels !== region.width * region.height)
          )
            failures.push(
              `${label}: whole-frame measurement does not cover viewport`
            )
          if (
            !Number.isFinite(region.detailMatchPercent) ||
            region.detailMatchPercent < 95 ||
            region.detailMatchPercent > 100 ||
            !Number.isSafeInteger(region.detailPixels) ||
            region.detailPixels <= 0 ||
            region.detailPixels > region.pixels
          )
            failures.push(`${label}/${region.name}: detail below 95 or missing`)
        }
        if (comparison.passed !== true)
          failures.push(`${label}: comparator reports FAIL`)
        if (
          resolve(base, frame.reference?.path ?? "") !==
          resolve(comparison.reference ?? "")
        )
          failures.push(`${label}: comparison reference differs`)
        if (
          resolve(base, frame.actual?.path ?? "") !==
          resolve(comparison.actual ?? "")
        )
          failures.push(`${label}: comparison screenshot differs`)
        if (reference && actual && reference.equals(actual))
          failures.push(
            `${label}: reference and runtime bytes are identical; check provenance`
          )
      } catch {
        failures.push(`${label}: invalid comparison JSON`)
      }
    }
    const reviewers = new Set()
    const reports = new Set()
    const roles = new Set()
    const evidenceSha256 = frameEvidenceSha256(frame, base)
    for (const review of frame.reviews ?? []) {
      const bytes = verified(review.report, `${label} review`)
      if (review.scope !== "full-frame" || review.verdict !== "PASS")
        failures.push(`${label}: review does not approve full frame`)
      const reviewer =
        typeof review.reviewer === "string" ? review.reviewer.trim() : ""
      if (!reviewer || reviewers.has(reviewer))
        failures.push(`${label}: reviewers must be distinct nonempty strings`)
      if (!review.report?.sha256 || reports.has(review.report.sha256))
        failures.push(`${label}: review reports must be distinct`)
      if (reviewer) reviewers.add(reviewer)
      reports.add(review.report?.sha256)
      if (!bytes?.length) failures.push(`${label}: empty review report`)
      if (bytes?.length) {
        try {
          const receipt = JSON.parse(bytes)
          if (receipt.evidenceSha256 !== evidenceSha256)
            failures.push(
              `${label}: review evidence differs from current capture/source`
            )
          if (
            receipt.reviewer !== reviewer ||
            receipt.scope !== review.scope ||
            receipt.verdict !== review.verdict
          )
            failures.push(`${label}: review receipt differs from manifest`)
          if (!["visual", "behavior-kit"].includes(receipt.role))
            failures.push(
              `${label}: review role must be visual or behavior-kit`
            )
          else roles.add(receipt.role)
          if (typeof receipt.findings !== "string" || !receipt.findings.trim())
            failures.push(`${label}: review findings required`)
        } catch {
          failures.push(
            `${label}: review report must be a structured JSON receipt`
          )
        }
      }
    }
    if (reviewers.size < 2 || reports.size < 2)
      failures.push(`${label}: two independent full-frame reviews required`)
    if (!roles.has("visual") || !roles.has("behavior-kit"))
      failures.push(
        `${label}: visual and behavior-kit review coverage required`
      )
  }
  for (const frame of expected)
    if (!seen.has(frame.id)) failures.push(`${frame.id}: missing evidence`)
  return {
    passed: failures.length === 0,
    claims: "evidence-metadata-only",
    expectedFrames: expected.length,
    suppliedFrames: records.length,
    failures,
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [releasePath, manifestPath] = process.argv.slice(2)
    if (!releasePath || !manifestPath)
      throw new Error(
        "Usage: audit-frame-acceptance.mjs <design-frames.json> <evidence-manifest.json>"
      )
    const result = auditFrameAcceptance(
      JSON.parse(readFileSync(releasePath)),
      JSON.parse(readFileSync(manifestPath)),
      dirname(resolve(manifestPath))
    )
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    process.exitCode = result.passed ? 0 : 1
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 2
  }
}
