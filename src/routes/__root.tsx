import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { SkipLink } from "@/ui/shell";
import { TooltipProvider } from "@/ui/tooltip";
import { AppToaster } from "@/ui/toaster";
import { NotFoundState } from "@/ui/empty-state";
import appCss from "@/styles/globals.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "OpenPath" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <NotFoundState
        title="That page is not here. Open OpenPath to start."
        href="/"
        label="Go to OpenPath"
      />
    </main>
  ),
  component: Root,
});

function Root() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <SkipLink />
        <TooltipProvider>
          <Outlet />
          <AppToaster />
        </TooltipProvider>
        <Scripts />
      </body>
    </html>
  );
}
