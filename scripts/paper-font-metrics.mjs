import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { openSync as openFont } from "fontkit"
import {
  CORPUS_DIRECTORY,
  FONTS_DIRECTORY,
  MANIFEST_FILE,
  METRICS_DIRECTORY,
  corpusTexts,
  faceMetrics,
  faceMetricsJson,
  neededCodePoints,
  sha256Hex,
} from "./lib/paper-font-metrics.mjs"

const root = fileURLToPath(new URL("..", import.meta.url))
const manifest = JSON.parse(readFileSync(join(root, MANIFEST_FILE), "utf8"))
const codePoints = neededCodePoints(corpusTexts(root))
for (const face of manifest.faces) {
  const file = join(root, FONTS_DIRECTORY, face.file)
  face.sha256 = sha256Hex(readFileSync(file))
  const font = openFont(file)
  const metrics = faceMetrics({
    face: face.face,
    file: face.file,
    sha256: face.sha256,
    font,
    codePoints,
  })
  writeFileSync(
    join(root, METRICS_DIRECTORY, `${face.face}.json`),
    faceMetricsJson(metrics)
  )
  const kernPairs = Object.values(metrics.kerning).reduce(
    (count, pairs) => count + Object.keys(pairs).length,
    0
  )
  console.log(
    `${face.face} advances=${codePoints.length} kernPairs=${kernPairs}`
  )
}
writeFileSync(
  join(root, MANIFEST_FILE),
  `${JSON.stringify(manifest, null, 2)}\n`
)
console.log(
  `${CORPUS_DIRECTORY} plus Vietnamese need ${codePoints.length} code points`
)
