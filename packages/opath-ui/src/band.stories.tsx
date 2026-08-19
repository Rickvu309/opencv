import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Band, BandFilter } from "./band";
import { Button } from "./button";

const meta: Meta<typeof Band> = {
  title: "Layouts/Band",
  component: Band,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "First element inside main on every screen that has chrome. Title is the one h1. Primary then quiet ghost secondaries. Filter row optional.",
      },
    },
  },
  args: { title: "The list" },
};

export default meta;
type Story = StoryObj<typeof Band>;

export const Default: Story = {
  args: {
    primary: <Button>Primary action</Button>,
  },
  decorators: [
    (Story) => (
      <div className="w-[32rem]">
        <Story />
      </div>
    ),
  ],
};

export const WithMetaAndFilter: Story = {
  render: function FilterStory() {
    const [filter, setFilter] = useState("all");
    return (
      <div className="w-[32rem]">
        <Band
          title="The list"
          meta="12 items"
          primary={<Button>Primary action</Button>}
          secondary={
            <Button variant="ghost" type="button">
              Secondary
            </Button>
          }
          filter={
            <BandFilter
              value={filter}
              onChange={setFilter}
              options={[
                { id: "all", label: "All" },
                { id: "one", label: "One" },
                { id: "two", label: "Two" },
              ]}
            />
          }
        />
      </div>
    );
  },
};

export const WithBack: Story = {
  render: () => (
    <div className="w-[32rem]">
      <Band
        back={
          <Button variant="ghost" type="button">
            Back
          </Button>
        }
        title="Opened item"
        meta="Type word"
        primary={<Button>Export</Button>}
      />
    </div>
  ),
};
