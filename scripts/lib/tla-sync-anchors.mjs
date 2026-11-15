export function detect(records, acceptedCommits) {
  return records
    .filter(({ sync }) => !acceptedCommits.has(sync))
    .map(
      ({ file, sync }) =>
        `${file}: sync ${sync} must belong to origin/main history`
    )
}
