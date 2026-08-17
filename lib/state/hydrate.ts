import { createServerFn } from "@tanstack/react-start";

import { initialAppState } from "./server";

export const loadAppState = createServerFn({ method: "GET" }).handler(() =>
  initialAppState(),
);
