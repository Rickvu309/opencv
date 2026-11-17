const TEST_ONLY =
  /(?:^|\/)test\/|\.(?:test|type-test|test-support|support)\.[cm]?[jt]sx?$|(?:[.-]fixtures?)\.[cm]?[jt]sx?$/

export function detect(files) {
  return files
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => file.includes("/apps/api/src/") && TEST_ONLY.test(file))
}
