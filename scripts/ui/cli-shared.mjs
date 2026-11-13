export const EXIT = Object.freeze({ ok: 0, failed: 1, usage: 2 })
export const json = (value) => JSON.stringify(value)

export async function withBrowser(ctx, work) {
  const browser = await ctx.browser.launch()
  try {
    return await work(browser)
  } finally {
    await browser.close()
  }
}
