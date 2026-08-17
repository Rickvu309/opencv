import * as React from "react";

/**
 * A hung turn has no exit of its own.
 *
 * Measured on the dead model: 420 seconds with no `turn.failed` and no
 * `onError`, just a typing indicator forever. The healthy model's local
 * baseline is 20s with a max of 22s, so 60s of total silence is well past
 * anything normal and safe to call dead.
 *
 * The server-side turn keeps running; this only stops the client waiting. If
 * it lands later the caller's reducer still applies it, and Coach edits
 * dedupe by `toolCallId`, so a late arrival cannot double-apply.
 *
 * `lastProgress` is a shared ref rather than owned here: the caller's
 * `useEveAgent` `onEvent` writes to it on every stream event, and this only
 * reads it. Owning it here would mean exposing a setter the caller has to
 * remember to wire up instead, one more thing to get wrong.
 *
 * `stop` is read through a ref, not depended on directly: `useEveAgent`
 * returns a fresh object every render, so a hook that took `agent.stop`
 * itself as a dependency would re-run this effect constantly and reset the
 * clock each time, the exact bug that let a hung turn run 189s past its own
 * deadline the first time this watchdog was written.
 */
export function useTurnWatchdog({
  turnRunning,
  stop,
  lastAskedRef,
  lastProgressRef,
  onTimeout,
}: {
  turnRunning: boolean;
  stop: () => void;
  lastAskedRef: React.RefObject<string>;
  lastProgressRef: React.RefObject<number>;
  onTimeout: (question: string) => void;
}) {
  const stopRef = React.useRef(stop);
  React.useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  React.useEffect(() => {
    if (!turnRunning) return;
    lastProgressRef.current = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - lastProgressRef.current < 60_000) return;
      clearInterval(timer);
      // Detach the client's stream so the indicator stops. `stop()` is local
      // and does not cancel the server's turn, which is what we want.
      stopRef.current();
      onTimeout(lastAskedRef.current);
    }, 5_000);
    return () => clearInterval(timer);
  }, [turnRunning, onTimeout, lastAskedRef, lastProgressRef]);
}
