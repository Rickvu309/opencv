import { createFileRoute } from "@tanstack/react-router";

import { HandlePanel } from "../(app)/settings/handle";
import { PlansPanel } from "../(app)/settings/plans";
import { SignInNeeded } from "../(app)/settings/sign-in-needed";
import { loadSettings } from "@/lib/settings/load";

export const Route = createFileRoute("/_app/settings")({
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
