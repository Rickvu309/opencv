import { createFileRoute } from "@tanstack/react-router";

import { loadSettings } from "@/lib/settings/load";

import { HandlePanel } from "./-handle";
import { PlansPanel } from "./-plans";
import { SignInNeeded } from "./-sign-in-needed";

export const Route = createFileRoute("/_signed-in/settings/")({
  loader: () => loadSettings(),
  component: SettingsPage,
});

function SettingsPage() {
  const data = Route.useLoaderData();
  if (!data.signedIn) return <SignInNeeded />;

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-3xl px-5 pt-8 sm:px-8">
        <HandlePanel initial={data.handle} />
      </div>
      <PlansPanel plan={data.plan} />
    </div>
  );
}
