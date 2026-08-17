import { safeNext } from "./gate";

/**
 * Where to send the browser after a successful sign-in or sign-up.
 *
 * A deep link they asked for wins. Otherwise a new or abandoned account goes
 * to first-run setup, and everyone else goes to the Coach.
 */
export function afterAuthPath({
  next,
  needsOnboarding,
}: {
  next?: string;
  needsOnboarding: boolean;
}): string {
  const destination = safeNext(next);
  if (destination) return destination;
  return needsOnboarding ? "/onboarding" : "/coach";
}
