import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Band, BandFilter } from "../band";
import { Button } from "../button";
import { Chip } from "../chip";
import { EmptyState } from "../empty-state";
import { EndOfList } from "../card";
import { GroupHeader, Row, RowList } from "../rows";

const meta: Meta = {
  title: "Patterns/Drive list",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const Rows: Story = {
  render: () => {
    const [filter, setFilter] = useState("all");
    return (
      <div className="w-[32rem] rounded-[var(--radius-container)] border border-hairline bg-surface-1 p-5">
        <Band
          title="The list"
          primary={<Button>Start one</Button>}
          filter={
            <BandFilter
              value={filter}
              onChange={setFilter}
              options={[
                { id: "all", label: "All" },
                { id: "open", label: "Open" },
              ]}
            />
          }
        />
        <GroupHeader label="Open" count={2} status="attention" />
        <RowList bleed>
          <Row
            label="First item"
            meta="Today"
            chip={
              <Chip tone="status" status="progress">
                In progress
              </Chip>
            }
            href="#p-1"
          />
          <Row label="Second item" meta="Yesterday" href="#p-2" />
        </RowList>
        <EndOfList />
      </div>
    );
  },
};

export const Empty: Story = {
  render: () => (
    <div className="w-[32rem] rounded-[var(--radius-container)] border border-hairline bg-surface-1 p-5">
      <Band title="The list" primary={<Button>Start one</Button>} />
      <EmptyState title="Nothing in this list yet." action={<Button>Start one</Button>} />
    </div>
  ),
};
