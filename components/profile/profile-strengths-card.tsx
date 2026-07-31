"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";

/**
 * Strengths chip grid. Each chip expands to the one-line evidence note
 * proving it, linked to a track record entry where seed data has one, so
 * the strength reads as backed by real work rather than a self-rating.
 */
export function ProfileStrengthsCard() {
  const { state, updateProfileStrengths } = useStore();
  const { strengths, strengthEvidence } = state.profile;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newStrength, setNewStrength] = useState("");

  function handleRemove(strength: string) {
    updateProfileStrengths(strengths.filter((item) => item !== strength));
    if (expanded === strength) setExpanded(null);
  }

  function handleAdd() {
    const trimmed = newStrength.trim();
    if (!trimmed || strengths.includes(trimmed)) return;
    updateProfileStrengths([...strengths, trimmed]);
    setNewStrength("");
    setAdding(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Strengths</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {strengths.map((strength) => {
            const evidence = strengthEvidence.find((item) => item.strength === strength);
            const isExpanded = expanded === strength;
            return (
              <div
                key={strength}
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-2.5 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : strength)}
                    className="text-left text-foreground"
                    aria-expanded={isExpanded}
                  >
                    {strength}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(strength)}
                    aria-label={`Remove ${strength}`}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                {isExpanded ? (
                  evidence ? (
                    <p className="text-xs text-muted-foreground">
                      {evidence.note}{" "}
                      {evidence.trackRecordEntryId ? (
                        <Link
                          href="/track-record"
                          className="font-medium text-foreground underline-offset-2 hover:underline"
                        >
                          View in Track Record
                        </Link>
                      ) : null}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No evidence linked yet.</p>
                  )
                ) : null}
              </div>
            );
          })}
        </div>

        {adding ? (
          <div className="flex gap-1.5">
            <Input
              autoFocus
              placeholder="Name a strength"
              value={newStrength}
              onChange={(event) => setNewStrength(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleAdd();
              }}
            />
            <Button size="sm" disabled={!newStrength.trim()} onClick={handleAdd}>
              Add
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="w-fit" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" />
            Add strength
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
