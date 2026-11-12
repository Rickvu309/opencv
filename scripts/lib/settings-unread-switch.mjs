export const SETTINGS_SCREEN_DIR = "apps/web/src/features/settings/"

export const READ_SETTING_KEYS = Object.freeze([
  "name",
  "language",
  "timeZone",
  "startPage",
  "memoryEnabled",
  "agentChat",
  "agentCvs",
  "agentInterview",
  "agentEmail",
])

export const NOT_A_READER = Object.freeze([
  /\.(?:test|type-test)\.[cm]?[jt]sx?$/,
  /^packages\/domain\//,
  /^apps\/api\/drizzle\//,
  /^apps\/api\/src\/account\/store\.ts$/,
  /^apps\/api\/src\/db\/(?:auth-)?schema\.ts$/,
  /^apps\/web\/src\/features\/settings\//,
  /^apps\/web\/src\/test\//,
])

const SAVED_KEY = /onSave\(\{\s*(\w+)\s*[:,}]/g
const LISTED_KEY = /\bkey:\s*"(\w+)"/g

export function offeredSettingKeys(source) {
  const keys = new Set()
  for (const pattern of [SAVED_KEY, LISTED_KEY])
    for (const match of source.matchAll(pattern)) keys.add(match[1])
  return [...keys].sort()
}

export function detect(source, file = "a Settings file") {
  return offeredSettingKeys(source)
    .filter((key) => !READ_SETTING_KEYS.includes(key))
    .map(
      (key) =>
        `${file}: Settings offers "${key}", which no product code reads, so the control saves a choice that changes nothing. Remove it from the screen until a feature reads it, or add the reader and list the key in READ_SETTING_KEYS.`
    )
}

export function isReaderFile(file) {
  return (
    /^(?:apps|packages)\//.test(file) &&
    !NOT_A_READER.some((pattern) => pattern.test(file))
  )
}

export function keysWithoutReader(keys, files) {
  return keys.filter(
    (key) =>
      !files.some(
        ({ path, text }) =>
          isReaderFile(path) && new RegExp(`\\b${key}\\b`).test(text)
      )
  )
}
