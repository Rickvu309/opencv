import type { Meta, StoryObj } from "@storybook/react-vite";
import { ApplyView, type ApplyRow } from "./apply-view";

const meta: Meta<typeof ApplyView> = {
  title: "Screens/Apply",
  component: ApplyView,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof ApplyView>;

const rows: ApplyRow[] = [
  {
    id: "1",
    role: "Business analyst intern",
    company: "Vietcombank",
    status: "interested",
    nextStep: "Tailor the CV and send it.",
    cv_paper_id: "cv1",
    master_cv_id: "m1",
  },
  {
    id: "2",
    role: "Operations intern",
    company: "Grab",
    status: "applied",
    nextStep: "Prepare your intro in Pitch.",
    cv_paper_id: null,
    master_cv_id: "m1",
  },
];

export const Empty: Story = {
  args: {
    rows: [],
    onStatus: () => undefined,
    onOpenCv: () => undefined,
    onTailor: () => undefined,
    onSearch: () => undefined,
  },
};

export const Pipeline: Story = {
  args: {
    rows,
    onStatus: () => undefined,
    onOpenCv: () => undefined,
    onTailor: () => undefined,
    onSearch: () => undefined,
  },
};

export const Loading: Story = {
  args: {
    pending: true,
    rows: [],
    onStatus: () => undefined,
    onOpenCv: () => undefined,
    onTailor: () => undefined,
    onSearch: () => undefined,
  },
};
