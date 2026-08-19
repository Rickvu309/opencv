import type { Meta, StoryObj } from "@storybook/react-vite";
import { Band, BandFilter } from "./band";
import { Button } from "./button";
import { useState } from "react";

const meta: Meta<typeof Band> = {
  title: "Primitives/Band",
  component: Band,
};
export default meta;

type Story = StoryObj<typeof Band>;

export const TitleAndPrimary: Story = {
  render: () => (
    <Band title="Paper" primary={<Button>Start a CV</Button>} />
  ),
};

export const WithFilter: Story = {
  render: function FilterStory() {
    const [value, setValue] = useState("all");
    return (
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
            value={value}
            onChange={setValue}
            options={[
              { id: "all", label: "All" },
              { id: "cv", label: "CV / Resume" },
              { id: "letter", label: "Letter" },
              { id: "uploaded", label: "Uploaded" },
            ]}
          />
        }
      />
    );
  },
};
