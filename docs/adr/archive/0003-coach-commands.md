# Coach acts through Commands

OpenPath's Coach may change product state only by running the same Commands a User can run (when a Command allows the Coach). This keeps coaching AI-native without a second write path. Supersede when the trust model changes on purpose.

**Parity.** User clicks and Coach tool calls share one Command registry, validation, and authorization. The Coach cannot do what the User cannot do through the product.

**Honesty.** The Coach must not claim an action succeeded unless the Command succeeded. Failures are said plainly.

**Consent.** Normal helpful actions may run when the User asked for the outcome. Destructive or hard-to-reverse Commands require explicit User confirmation in the UI before execution.

**Reversibility.** Prefer Commands that can be undone or shown in a clear history; where undo is impossible, say so.

**Surfaces.** Paper, Pitch, and Opportunity analyse are first Command consumers; Search stays out of near-term scope.

**Out of scope here:** Exact bus implementation, model vendor, and SSE details.
