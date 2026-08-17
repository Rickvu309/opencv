import { createServerFn } from "@tanstack/react-start";

import { initialConversations } from "./server";

export const loadConversations = createServerFn({ method: "GET" }).handler(() =>
  initialConversations(),
);
