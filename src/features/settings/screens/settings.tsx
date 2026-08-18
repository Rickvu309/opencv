import { useQuery } from "@tanstack/react-query";
import { getSettingsFn } from "@/features/share/queries";
import { signOutFn } from "@/features/auth/server";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Band } from "@/ui/band";
import { Section } from "@/ui/section";
import { SkeletonSection } from "@/ui/skeleton";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export function SettingsScreen() {
  const q = useQuery({ queryKey: ["settings"], queryFn: () => getSettingsFn() });
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const prefs = (q.data?.prefs ?? {}) as { deadline?: boolean; idle?: boolean };

  return (
    <div className="mx-auto max-w-lg">
      <Band title="Settings" />
      {q.isPending ? <SkeletonSection /> : null}
      {q.data ? (
        <>
          <Section label="Account">
            <p className="text-ink-muted">{q.data.email}</p>
            <Label htmlFor="email">New email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={q.data.email}
            />
            <Label htmlFor="email-password">Current password</Label>
            <Input
              id="email-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={() =>
                void runCommand("account.updateEmail", { email, password }).then(() => q.refetch())
              }
            >
              Change email
            </Button>
            <Label htmlFor="current">Current password</Label>
            <Input id="current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            <Label htmlFor="next">New password</Label>
            <Input id="next" type="password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
            <Button
              variant="outline"
              onClick={() => void runCommand("account.updatePassword", { current, next })}
            >
              Change password
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await signOutFn();
                await navigate({ to: "/sign-in" });
              }}
            >
              Sign out
            </Button>
          </Section>

          <Section label="Public page">
            <Label htmlFor="handle">Handle</Label>
            <Input defaultValue={q.data.handle ?? ""} id="handle" placeholder="your-handle" />
            <Button
              variant="outline"
              onClick={() =>
                void runCommand("share.setHandle", {
                  handle: (document.getElementById("handle") as HTMLInputElement).value,
                }).then(() => q.refetch())
              }
            >
              Save handle
            </Button>
          </Section>

          <Section label="Notifications">
            <label className="flex min-h-11 items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                defaultChecked={prefs.deadline !== false}
                id="pref-deadline"
              />
              Email me before deadlines
            </label>
            <label className="flex min-h-11 items-center gap-2 text-[13px]">
              <input type="checkbox" defaultChecked={prefs.idle !== false} id="pref-idle" />
              Email me when an application sits idle
            </label>
            <Button
              variant="outline"
              onClick={() =>
                void runCommand("account.setNotificationPrefs", {
                  deadline: (document.getElementById("pref-deadline") as HTMLInputElement).checked,
                  idle: (document.getElementById("pref-idle") as HTMLInputElement).checked,
                })
              }
            >
              Save notification prefs
            </Button>
          </Section>

          <Section label="Delete account">
            <p className="text-[13px] text-ink-muted">
              This removes your papers, Proofs, and conversations.
            </p>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete account
            </Button>
          </Section>
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title="Delete this account?"
            body="This removes your papers, Proofs, and conversations."
            confirmLabel="Delete account"
            onConfirm={() => {
              void runCommand("account.remove", { confirm: "delete" }).then(() =>
                navigate({ to: "/sign-in" }),
              );
            }}
          />
        </>
      ) : null}
    </div>
  );
}
