import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Band, BandFilter } from "../band";
import { Button } from "../button";

const meta: Meta = {
  title: "Components/Band",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const TitleAndPrimary: Story = {
  render: () => (
    <div className="w-[32rem]">
      <Band title="The list" primary={<Button>Primary action</Button>} />
    </div>
  ),
};

export const WithMetaAndFilter: Story = {
  render: () => {
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
