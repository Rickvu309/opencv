import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";

import { NotFound } from "@/components/not-found";
import { AppStateProvider } from "@/lib/actions/store";
import { loadAppState } from "@/lib/state/hydrate";
import appCss from "./globals.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: () => loadAppState(),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: "OpenPath, AI Career Coach" },
      {
        name: "description",
        content:
          "A career coach for students and new graduates who do not have a direction yet.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: NotFound,
  component: RootComponent,
});

function RootComponent() {
  const { state: initial, signedIn } = Route.useLoaderData();
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-full flex flex-col">
        <AppStateProvider initial={initial} signedIn={signedIn}>
          <Outlet />
        </AppStateProvider>
        <Scripts />
      </body>
    </html>
  );
}
