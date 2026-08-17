import { useQuery } from "@tanstack/react-query";
import { getSettingsFn } from "@/features/share/queries";
import { signOutFn } from "@/features/auth/server";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export function SettingsScreen() {
  const q = useQuery({ queryKey: ["settings"], queryFn: () => getSettingsFn() });
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  if (!q.data) return <p>Loading settings.</p>;
  const prefs = (q.data.prefs ?? {}) as { deadline?: boolean; idle?: boolean };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-[28px] font-medium">Settings</h1>
      <p className="mt-2 text-muted-foreground">{q.data.email}</p>

      <section className="mt-8 space-y-3">
        <h2 className="text-[18px] font-medium">Email</h2>
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
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-[18px] font-medium">Password</h2>
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
      </section>

      <section className="mt-8">
        <h2 className="text-[18px] font-medium">Public page</h2>
        <Label htmlFor="handle">Handle</Label>
        <Input defaultValue={q.data.handle ?? ""} id="handle" placeholder="your-handle" />
        <Button
          className="mt-2"
          variant="outline"
          onClick={() =>
            void runCommand("share.setHandle", {
              handle: (document.getElementById("handle") as HTMLInputElement).value,
            }).then(() => q.refetch())
          }
        >
          Save handle
        </Button>
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="text-[18px] font-medium">Notifications</h2>
        <label className="flex items-center gap-2 text-[14px]">
          <input
            type="checkbox"
            defaultChecked={prefs.deadline !== false}
            id="pref-deadline"
          />
          Deadline reminders
        </label>
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" defaultChecked={prefs.idle !== false} id="pref-idle" />
          Idle nudges
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
      </section>

      <Button
        className="mt-10"
        variant="ghost"
        onClick={async () => {
          await signOutFn();
          await navigate({ to: "/sign-in" });
        }}
      >
        Sign out
      </Button>
      <section className="mt-16">
        <h2 className="text-[18px] font-medium">Delete account</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Type delete to confirm. This removes your papers, Proofs, and conversations.
        </p>
        <Button
          className="mt-3"
          variant="danger"
          onClick={() => {
            const typed = window.prompt("Type delete to remove your account");
            if (typed === "delete") {
              void runCommand("account.remove", { confirm: "delete" }).then(() =>
                navigate({ to: "/sign-in" }),
              );
            }
          }}
        >
          Delete
        </Button>
      </section>
    </div>
  );
}
