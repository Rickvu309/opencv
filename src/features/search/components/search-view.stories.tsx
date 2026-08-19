import type { Meta, StoryObj } from "@storybook/react-vite";
import { OpeningDetailView, SearchView, type SearchOpening } from "./search-view";

const meta: Meta = {
  title: "Drive/Search",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

const openings: SearchOpening[] = [
  {
    id: "1",
    title: "Business analyst intern",
    company: "Vietcombank",
    location: "Hà Nội",
    fit: {
      met: 4,
      total: 6,
      items: [
        { text: "Excel", met: true },
        { text: "SQL", met: false },
      ],
      gap: ["SQL", "Python"],
    },
  },
  {
    id: "2",
    title: "Operations intern",
    company: "Grab",
    location: "TP.HCM",
    fit: { met: 5, total: 6, items: [{ text: "Excel", met: true }], gap: [] },
  },
];

export const Empty: Story = {
  render: () => (
    <SearchView
      openings={[]}
      visible={[]}
      filter=""
      onFilter={() => undefined}
      raw=""
      onRaw={() => undefined}
      onPaste={() => undefined}
      onSelect={() => undefined}
    />
  ),
};

export const Rows: Story = {
  render: () => (
    <SearchView
      openings={openings}
      visible={openings}
      filter=""
      onFilter={() => undefined}
      raw=""
      onRaw={() => undefined}
      onPaste={() => undefined}
      onSelect={() => undefined}
    />
  ),
};

export const Detail: Story = {
  render: () => (
    <OpeningDetailView
      opening={openings[0]!}
      onBack={() => undefined}
      onSave={() => undefined}
      onAskCoach={() => undefined}
    />
  ),
};

export const ThinProfile: Story = {
  render: () => (
    <SearchView
      thin
      openings={[]}
      visible={[]}
      filter=""
      onFilter={() => undefined}
      raw=""
      onRaw={() => undefined}
      onPaste={() => undefined}
      onSelect={() => undefined}
    />
  ),
};
