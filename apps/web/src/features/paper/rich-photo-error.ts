export function photoErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Could not change the photo. Try again."
  if (error.message.includes("Photo exceeds its flow column"))
    return "This photo is wider than the space available. Reduce its width and try again."
  if (error.name === "ZodError" || error.message.trimStart().startsWith("["))
    return "This photo's size or crop cannot fit on the page. Use a smaller size or reduce the crop and try again."
  return error.message
}
