export function whenIdle(work: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(work)
    return () => window.cancelIdleCallback(handle)
  }
  const channel = new MessageChannel()
  let live = true
  channel.port1.onmessage = () => {
    if (live) work()
    channel.port1.close()
  }
  channel.port2.postMessage(null)
  return () => {
    live = false
    channel.port1.close()
  }
}
