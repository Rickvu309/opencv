"use client";

import { cloneElement, isValidElement, useId, useState } from "react";
import type { ReactElement } from "react";
import { Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AskCopilotButton } from "@/components/shared/ask-copilot-button";
import { useStore } from "@/lib/store";
import type { ProfilePreferences } from "@/lib/types";

const WORK_MODE_OPTIONS: ProfilePreferences["workStyle"][] = ["Remote", "Hybrid", "On-site"];

interface PreferencesDraft {
  workStyle: ProfilePreferences["workStyle"];
  companySize: string;
  salaryFloor: string;
  location: string;
  dealBreakers: string[];
}

function draftFromPreferences(preferences: ProfilePreferences): PreferencesDraft {
  return {
    workStyle: preferences.workStyle,
    companySize: preferences.companySize,
    salaryFloor: preferences.salaryFloor,
    location: preferences.location,
    dealBreakers: [...preferences.dealBreakers],
  };
}

/**
 * Preferences and constraints: work mode, company size, salary floor,
 * location constraints, and deal breakers. One edit and save state for the
 * whole card, since these fields are read and written together.
 */
export function ProfilePreferencesCard() {
  const { state, updateProfilePreferences } = useStore();
  const { preferences } = state.profile;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PreferencesDraft>(draftFromPreferences(preferences));
  const [newDealBreaker, setNewDealBreaker] = useState("");

  function startEditing() {
    setDraft(draftFromPreferences(preferences));
    setNewDealBreaker("");
    setEditing(true);
  }

  function handleSave() {
    updateProfilePreferences({
      workStyle: draft.workStyle,
      companySize: draft.companySize.trim(),
      salaryFloor: draft.salaryFloor.trim(),
      location: draft.location.trim(),
      dealBreakers: draft.dealBreakers,
    });
    setEditing(false);
  }

  function handleAddDealBreaker() {
    const trimmed = newDealBreaker.trim();
    if (!trimmed || draft.dealBreakers.includes(trimmed)) return;
    setDraft({ ...draft, dealBreakers: [...draft.dealBreakers, trimmed] });
    setNewDealBreaker("");
  }

  function handleRemoveDealBreaker(dealBreaker: string) {
    setDraft({ ...draft, dealBreakers: draft.dealBreakers.filter((item) => item !== dealBreaker) });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences and constraints</CardTitle>
        {editing ? null : (
          <CardAction className="flex items-center gap-1">
            <AskCopilotButton surface="Profile" objectLabel="Preferences section" />
            <Button size="icon-sm" variant="ghost" aria-label="Edit preferences" onClick={startEditing}>
              <Pencil className="size-3.5" />
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {editing ? (
          <>
            <Field label="Work mode">
              <Select
                value={draft.workStyle}
                onValueChange={(value) => setDraft({ ...draft, workStyle: value as ProfilePreferences["workStyle"] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_MODE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Company size">
              <Input
                value={draft.companySize}
                onChange={(event) => setDraft({ ...draft, companySize: event.target.value })}
              />
            </Field>
            <Field label="Salary floor">
              <Input
                value={draft.salaryFloor}
                onChange={(event) => setDraft({ ...draft, salaryFloor: event.target.value })}
              />
            </Field>
            <Field label="Location constraints">
              <Input
                value={draft.location}
                onChange={(event) => setDraft({ ...draft, location: event.target.value })}
              />
            </Field>
            <Field label="Deal breakers">
              <div className="flex flex-col gap-1.5">
                {draft.dealBreakers.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {draft.dealBreakers.map((dealBreaker) => (
                      <span
                        key={dealBreaker}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
                      >
                        {dealBreaker}
                        <button
                          type="button"
                          aria-label={`Remove ${dealBreaker}`}
                          onClick={() => handleRemoveDealBreaker(dealBreaker)}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No deal breakers set yet.</p>
                )}
                <div className="flex gap-1.5">
                  <Input
                    placeholder="Add a deal breaker"
                    value={newDealBreaker}
                    onChange={(event) => setNewDealBreaker(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleAddDealBreaker();
                    }}
                  />
                  <Button size="sm" variant="outline" disabled={!newDealBreaker.trim()} onClick={handleAddDealBreaker}>
                    Add
                  </Button>
                </div>
              </div>
            </Field>
            <div className="flex gap-1.5">
              <Button size="sm" onClick={handleSave}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <ReadField label="Work mode" value={preferences.workStyle} />
            <ReadField label="Company size" value={preferences.companySize} />
            <ReadField label="Salary floor" value={preferences.salaryFloor} />
            <ReadField label="Location constraints" value={preferences.location} />
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Deal breakers</dt>
              {preferences.dealBreakers.length > 0 ? (
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {preferences.dealBreakers.map((dealBreaker) => (
                    <span
                      key={dealBreaker}
                      className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
                    >
                      {dealBreaker}
                    </span>
                  ))}
                </dd>
              ) : (
                <dd className="mt-1 text-muted-foreground">None set yet.</dd>
              )}
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      {isValidElement(children) ? cloneElement(children, { id }) : children}
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
