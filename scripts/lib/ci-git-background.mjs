const SETUP = ".github/actions/setup/action.yml"
const SETTINGS = [
  [
    /^\s*sudo git config --system maintenance\.auto false\s*$/m,
    "maintenance.auto false",
  ],
  [/^\s*sudo git config --system gc\.auto 0\s*$/m, "gc.auto 0"],
]

export function detect(text, file) {
  if (!String(file).endsWith(SETUP)) return []
  return SETTINGS.filter(([pattern]) => !pattern.test(String(text))).map(
    ([, name]) =>
      `setup must set ${name} for every repository on the runner, or a test's git commit starts a background process that outlives the test and can put its temporary folder back`
  )
}
