const failureKey = (failure) => `${failure.element}\u0000${failure.property}`

export function markKnownFailures(result, base) {
  if (!base || base.error || !Array.isArray(base.failures)) return result
  const onMain = new Map(
    base.failures.map((failure) => [failureKey(failure), failure])
  )
  const failures = result.failures.map((failure) => {
    const known = onMain.get(failureKey(failure))
    return { ...failure, onMain: known ? { rendered: known.rendered } : null }
  })
  const newFailed = failures.filter((failure) => !failure.onMain).length
  return {
    ...result,
    failures,
    newFailed,
    knownFailed: failures.length - newFailed,
  }
}

export function knownFailureLines(result) {
  if (result.newFailed === undefined) return []
  const listed = (pick) =>
    result.failures
      .filter(pick)
      .map((failure) => `${failure.element} ${failure.property}`)
      .join("; ") || "none"
  return [
    `new since main: ${listed((failure) => !failure.onMain)}`,
    `already failing on main: ${listed((failure) => failure.onMain)}`,
  ]
}

export function baseCheckFor(manifest, screen) {
  return manifest?.baseChecks?.[screen]
}

export async function checkBaseScreen(check, browser, state, screen) {
  try {
    return await check(browser, state, screen)
  } catch (error) {
    return { screen: screen.id, error: error.message.split("\n")[0] }
  }
}
