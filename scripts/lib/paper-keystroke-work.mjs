export function detect(sample) {
  const failures = []
  if (sample.blocksLaidOut !== 1)
    failures.push("expected one block to be shaped")
  if (sample.pagesPaginated !== 1)
    failures.push("expected one page to be paginated")
  if (sample.pages.length !== 1 || sample.pages[0] !== 1)
    failures.push("DOM writes reached outside the edited page")
  if (sample.lines < 1 || sample.lines > 2)
    failures.push("expected DOM writes on one or two lines")
  if (sample.caretWrites > 2) failures.push("caret geometry was rewritten")
  if (sample.suggestionWrites !== 0)
    failures.push("suggestion controls changed")
  if (sample.reactCommits !== 0) failures.push("React committed during typing")
  return failures
}
