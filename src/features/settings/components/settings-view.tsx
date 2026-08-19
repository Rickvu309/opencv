import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Band } from "@/ui/band";
import { FieldRow, Section } from "@/ui/section";
import { SkeletonSection } from "@/ui/skeleton";
import { Switch } from "@/ui/switch";
import { QueryError } from "@/ui/empty-state";
import { ConfirmDialog } from "@/ui/confirm-dialog";

export type SettingsViewData = {
  email: string;
  handle: string;
  prefs: { deadline?: boolean; idle?: boolean };
};

export function SettingsView({
  pending,
  error,
  onRetry,
  data,
  email,
  onEmail,
  emailPassword,
  onEmailPassword,
  onChangeEmail,
  currentPassword,
  onCurrentPassword,
  nextPassword,
  onNextPassword,
  onChangePassword,
  onSignOut,
  handle,
  onHandle,
  onSaveHandle,
  deadline,
  onDeadline,
  idle,
  onIdle,
  onSavePrefs,
  confirmDelete,
  onConfirmDelete,
  onDelete,
}: {
  pending?: boolean;
  error?: boolean;
  onRetry?: () => void;
  data?: SettingsViewData;
  email: string;
  onEmail: (value: string) => void;
  emailPassword: string;
  onEmailPassword: (value: string) => void;
  onChangeEmail: () => void;
  currentPassword: string;
  onCurrentPassword: (value: string) => void;
  nextPassword: string;
  onNextPassword: (value: string) => void;
  onChangePassword: () => void;
  onSignOut: () => void;
  handle: string;
  onHandle: (value: string) => void;
  onSaveHandle: () => void;
  deadline: boolean;
  onDeadline: (value: boolean) => void;
  idle: boolean;
  onIdle: (value: boolean) => void;
  onSavePrefs: () => void;
  confirmDelete: boolean;
  onConfirmDelete: (open: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <div className="max-w-xl">
      <Band title="Settings" />
      {pending ? <SkeletonSection /> : null}
      {error ? <QueryError onRetry={() => onRetry?.()} /> : null}
      {data ? (
        <>
          <Section label="Account">
            <p className="text-ink-muted">{data.email}</p>
            <p className="mt-6 text-[13px] font-[510]">Change email</p>
            <FieldRow label="New email" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => onEmail(e.target.value)}
                placeholder={data.email}
              />
            </FieldRow>
            <FieldRow label="Current password" htmlFor="email-password">
              <Input
                id="email-password"
                type="password"
                value={emailPassword}
                onChange={(e) => onEmailPassword(e.target.value)}
              />
            </FieldRow>
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={onChangeEmail}>
                Change email
              </Button>
            </div>
            <p className="mt-8 text-[13px] font-[510]">Change password</p>
            <FieldRow label="Current password" htmlFor="current">
              <Input
                id="current"
                type="password"
                value={currentPassword}
                onChange={(e) => onCurrentPassword(e.target.value)}
              />
            </FieldRow>
            <FieldRow label="New password" htmlFor="next">
              <Input
                id="next"
                type="password"
                minLength={8}
                value={nextPassword}
                onChange={(e) => onNextPassword(e.target.value)}
              />
            </FieldRow>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onChangePassword}>
                Change password
              </Button>
              <Button variant="ghost" onClick={onSignOut}>
                Sign out
              </Button>
            </div>
          </Section>

          <Section label="Public page">
            <FieldRow label="Handle" htmlFor="handle">
              <Input
                id="handle"
                value={handle}
                onChange={(e) => onHandle(e.target.value)}
                placeholder="your-handle"
              />
            </FieldRow>
            <div className="flex justify-end pt-3">
              <Button variant="outline" onClick={onSaveHandle}>
                Save handle
              </Button>
            </div>
          </Section>

          <Section label="Notifications">
            <FieldRow label="Email me before deadlines" htmlFor="pref-deadline">
              <Switch
                id="pref-deadline"
                checked={deadline}
                onCheckedChange={onDeadline}
                aria-label="Email me before deadlines"
              />
            </FieldRow>
            <FieldRow label="Email me when an application sits idle" htmlFor="pref-idle">
              <Switch
                id="pref-idle"
                checked={idle}
                onCheckedChange={onIdle}
                aria-label="Email me when an application sits idle"
              />
            </FieldRow>
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={onSavePrefs}>
                Save notification prefs
              </Button>
            </div>
          </Section>

          <Section label="Delete account">
            <p className="text-[13px] text-ink-muted">
              This removes your papers, Proofs, and conversations.
            </p>
            <div className="flex justify-end pt-3">
              <Button variant="danger" onClick={() => onConfirmDelete(true)}>
                Delete account
              </Button>
            </div>
          </Section>
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={onConfirmDelete}
            title="Delete this account?"
            body="This removes your papers, Proofs, and conversations."
            confirmLabel="Delete account"
            onConfirm={onDelete}
          />
        </>
      ) : null}
    </div>
  );
}
