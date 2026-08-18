import { useQuery } from "@tanstack/react-query";
import { getSettingsFn } from "@/features/share/queries";
import { signOutFn } from "@/features/auth/server";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Band } from "@/ui/band";
import { FieldRow, Section } from "@/ui/section";
import { SkeletonSection } from "@/ui/skeleton";
import { Switch } from "@/ui/switch";
import { QueryError } from "@/ui/empty-state";
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
  const [deadline, setDeadline] = useState<boolean | null>(null);
  const [idle, setIdle] = useState<boolean | null>(null);
  const prefs = (q.data?.prefs ?? {}) as { deadline?: boolean; idle?: boolean };

  return (
    <div className="max-w-xl">
      <Band title="Settings" />
      {q.isPending ? <SkeletonSection /> : null}
      {q.isError ? <QueryError onRetry={() => void q.refetch()} /> : null}
      {q.data ? (
        <>
          <Section label="Account">
            <p className="text-ink-muted">{q.data.email}</p>
            <p className="mt-6 text-[13px] font-[510]">Change email</p>
            <FieldRow label="New email" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={q.data.email}
              />
            </FieldRow>
            <FieldRow label="Current password" htmlFor="email-password">
              <Input
                id="email-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FieldRow>
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={() =>
                  void runCommand("account.updateEmail", { email, password }).then(() =>
                    q.refetch(),
                  )
                }
              >
                Change email
              </Button>
            </div>
            <p className="mt-8 text-[13px] font-[510]">Change password</p>
            <FieldRow label="Current password" htmlFor="current">
              <Input
                id="current"
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </FieldRow>
            <FieldRow label="New password" htmlFor="next">
              <Input
                id="next"
                type="password"
                minLength={8}
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </FieldRow>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
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
            </div>
          </Section>

          <Section label="Public page">
            <FieldRow label="Handle" htmlFor="handle">
              <Input defaultValue={q.data.handle ?? ""} id="handle" placeholder="your-handle" />
            </FieldRow>
            <div className="flex justify-end pt-3">
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
            </div>
          </Section>

          <Section label="Notifications">
            <FieldRow label="Email me before deadlines" htmlFor="pref-deadline">
              <Switch
                id="pref-deadline"
                checked={deadline ?? prefs.deadline !== false}
                onCheckedChange={(v) => setDeadline(v)}
                aria-label="Email me before deadlines"
              />
            </FieldRow>
            <FieldRow label="Email me when an application sits idle" htmlFor="pref-idle">
              <Switch
                id="pref-idle"
                checked={idle ?? prefs.idle !== false}
                onCheckedChange={(v) => setIdle(v)}
                aria-label="Email me when an application sits idle"
              />
            </FieldRow>
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={() =>
                  void runCommand("account.setNotificationPrefs", {
                    deadline: deadline ?? prefs.deadline !== false,
                    idle: idle ?? prefs.idle !== false,
                  })
                }
              >
                Save notification prefs
              </Button>
            </div>
          </Section>

          <Section label="Delete account">
            <p className="text-[13px] text-ink-muted">
              This removes your papers, Proofs, and conversations.
            </p>
            <div className="flex justify-end pt-3">
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                Delete account
              </Button>
            </div>
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
