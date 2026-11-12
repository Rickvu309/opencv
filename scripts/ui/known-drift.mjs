const failureKey = (failure) => `${failure.element}\u0000${failure.property}`

const isNewSinceMain = (failure) => !failure.onMain || failure.onMain.changed

export function markKnownFailures(result, base) {
  if (!base || base.error || !Array.isArray(base.failures)) return result
  const onMain = new Map(
    base.failures.map((failure) => [failureKey(failure), failure])
  )
  const failures = result.failures.map((failure) => {
    const known = onMain.get(failureKey(failure))
    if (!known) return { ...failure, onMain: null }
    return {
      ...failure,
      onMain: {
        rendered: known.rendered,
        changed: known.rendered !== failure.rendered,
      },
    }
  })
  const newFailed = failures.filter(isNewSinceMain).length
  return {
    ...result,
    failures,
    newFailed,
    knownFailed: failures.length - newFailed,
  }
}

export function knownFailureLines(result) {
  if (result.newFailed === undefined) return []
  const listed = (pick, describe) =>
    result.failures.filter(pick).map(describe).join("; ") || "none"
  const named = (failure) => `${failure.element} ${failure.property}`
  return [
    `new since main: ${listed((failure) => !failure.onMain, named)}`,
    `changed since main: ${listed(
      (failure) => failure.onMain?.changed,
      (failure) =>
        `${named(failure)} ${failure.onMain.rendered ?? "missing"} on main, ${failure.rendered ?? "missing"} here`
    )}`,
    `already failing on main: ${listed(
      (failure) => failure.onMain && !failure.onMain.changed,
      named
    )}`,
  ]
}

export function baseCheckFor(manifest, screen) {
  return manifest?.baseChecks?.[screen]
}

export function staleBaseLine(manifest, mergeBase) {
  if (!manifest?.baseSha)
    return "known drift: the manifest records no base commit, so it may not match origin/main; rerun node scripts/ui.mjs compare"
  if (!mergeBase)
    return "known drift: could not find this branch's merge-base with origin/main, so the manifest's main results may be stale; run git fetch origin main"
  if (manifest.baseSha === mergeBase) return null
  return `known drift: the manifest was made on ${manifest.baseSha.slice(0, 12)}, but this branch's merge-base with origin/main is ${mergeBase.slice(0, 12)}; its main results may be stale, rerun node scripts/ui.mjs compare`
}

export async function checkBaseScreen(check, browser, state, screen) {
  try {
    return await check(browser, state, screen)
  } catch (error) {
    return { screen: screen.id, error: error.message.split("\n")[0] }
  }
}
