# Coach validates; the browser applies

The Coach must edit artefacts, but AppState lives in the tab. Giving the agent a second write path (Postgres, or mutating from the tool) would fork the store: the UI and the Coach would disagree, undo would only cover one of them, and a bad tool call could corrupt the row.

So `apply_action` only validates the payload against the action’s schema and returns an envelope. [`dispatch`](../../lib/actions/store.tsx) in the browser is the only mutation: it runs `applyAction`, announces, offers undo, and persists. A click and a Coach turn are then the same change.

The rejected alternative was applying inside the tool (server-side), which looks simpler until the store, the toast, and the account row are three different writes.
