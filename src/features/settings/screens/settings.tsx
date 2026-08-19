import { useQuery } from "@tanstack/react-query";
import { getSettingsFn } from "@/features/share/queries";
import { signOutFn } from "@/features/auth/server";
import { runCommand } from "@/ui/run-command";
import { SettingsView } from "@/features/settings/components/settings-view";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export function SettingsScreen() {
  const q = useQuery({ queryKey: ["settings"], queryFn: () => getSettingsFn() });
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [handle, setHandle] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deadline, setDeadline] = useState<boolean | null>(null);
  const [idle, setIdle] = useState<boolean | null>(null);
  const prefs = (q.data?.prefs ?? {}) as { deadline?: boolean; idle?: boolean };

  return (
    <SettingsView
      pending={q.isPending}
      error={q.isError}
      onRetry={() => void q.refetch()}
      data={
        q.data
          ? {
              email: q.data.email,
              handle: q.data.handle ?? "",
              prefs,
            }
          : undefined
      }
      email={email}
      onEmail={setEmail}
      emailPassword={password}
      onEmailPassword={setPassword}
      onChangeEmail={() =>
        void runCommand("account.updateEmail", { email, password }).then(() => q.refetch())
      }
      currentPassword={current}
      onCurrentPassword={setCurrent}
      nextPassword={next}
      onNextPassword={setNext}
      onChangePassword={() => void runCommand("account.updatePassword", { current, next })}
      onSignOut={async () => {
        await signOutFn();
        await navigate({ to: "/sign-in" });
      }}
      handle={handle ?? q.data?.handle ?? ""}
      onHandle={setHandle}
      onSaveHandle={() =>
        void runCommand("share.setHandle", {
          handle: handle ?? q.data?.handle ?? "",
        }).then(() => q.refetch())
      }
      deadline={deadline ?? prefs.deadline !== false}
      onDeadline={setDeadline}
      idle={idle ?? prefs.idle !== false}
      onIdle={setIdle}
      onSavePrefs={() =>
        void runCommand("account.setNotificationPrefs", {
          deadline: deadline ?? prefs.deadline !== false,
          idle: idle ?? prefs.idle !== false,
        })
      }
      confirmDelete={confirmDelete}
      onConfirmDelete={setConfirmDelete}
      onDelete={() => {
        void runCommand("account.remove", { confirm: "delete" }).then(() =>
          navigate({ to: "/sign-in" }),
        );
      }}
    />
  );
}
