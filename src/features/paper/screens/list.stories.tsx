import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Band, BandFilter } from "@/ui/band";
import { Button } from "@/ui/button";
import { Row, RowList, RowListHeader } from "@/ui/rows";
import { EmptyState } from "@/ui/empty-state";
import { EndOfList } from "@/ui/card";

const meta: Meta = {
  title: "Paper/List",
};
export default meta;

type Story = StoryObj;

const rows = [
  { id: "1", label: "Cover letter — Grab", type: "Cover letter", updated: "1 hour ago" },
  { id: "2", label: "Untitled CV", type: "CV", updated: "2 days ago" },
  { id: "3", label: "Linh-CV.pdf", type: "Uploaded", updated: "5 days ago" },
];

export const Filled: Story = {
  render: function FilledStory() {
    const [filter, setFilter] = useState("all");
    const visible =
      filter === "all"
        ? rows
        : filter === "uploaded"
          ? rows.filter((r) => r.type === "Uploaded")
          : filter === "letter"
            ? rows.filter((r) => r.type === "Cover letter")
            : rows.filter((r) => r.type === "CV");
    return (
      <div className="px-5 py-4">
        <Band
          title="Paper"
          primary={<Button>Start a CV</Button>}
          secondary={
            <>
              <Button variant="ghost">Start a letter</Button>
              <Button variant="ghost">I already have a file</Button>
            </>
          }
          filter={
            <BandFilter
              value={filter}
              onChange={setFilter}
              options={[
                { id: "all", label: "All" },
                { id: "cv", label: "CV / Resume" },
                { id: "letter", label: "Letter" },
                { id: "uploaded", label: "Uploaded" },
              ]}
            />
          }
        />
        <RowList bleed>
          <RowListHeader />
          {visible.map((row) => (
            <Row
              key={row.id}
              label={row.label}
              type={row.type}
              updated={row.updated}
              onSelect={() => undefined}
              menu={
                <button
                  type="button"
                  className="flex size-11 items-center justify-center rounded-[var(--radius-control)] text-[13px]"
                  aria-label={`Actions for ${row.label}`}
                >
                  ···
                </button>
              }
            />
          ))}
        </RowList>
        <EndOfList />
      </div>
    );
  },
};

export const Empty: Story = {
  render: () => (
    <div className="px-5 py-4">
      <Band title="Paper" primary={<Button>Start a CV</Button>} />
      <EmptyState
        kind="first-run"
        title="Start with the CV."
        action={<Button variant="ghost">Start a CV</Button>}
      />
    </div>
  ),
};
