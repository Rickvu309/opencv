const LABELLED_STAGE_ICON = /<StageIcon\b(?![^>]*\bdecorative\b)[^>]*\/>/g
const WRITTEN_STAGE_NAME =
  /^(?:\s|<\/?span[^>]*>|<h\d[^>]*>|<RailLabel>)*\{\s*(?:stageLabel\(|railStageLabel\(|STAGE_LABEL\[|name\s*\})|^(?:\s|<\/?span[^>]*>|<h\d[^>]*>)*(?:Saved|Applied|Interview|Offer|Closed)\s*</

export const STAGE_NAME_HINT =
  "a StageIcon beside its written stage name must be decorative, or screen readers hear the stage twice"

const lineOf = (source, index) => source.slice(0, index).split("\n").length

export function stageNamesReadTwice(source, fileName = "file.tsx") {
  const problems = []
  for (const match of source.matchAll(LABELLED_STAGE_ICON)) {
    const after = source.slice(match.index + match[0].length)
    if (WRITTEN_STAGE_NAME.test(after)) {
      problems.push(
        `${fileName}:${lineOf(source, match.index)}: ${match[0]}; ${STAGE_NAME_HINT}`
      )
    }
  }
  return problems
}
