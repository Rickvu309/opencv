import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@/ui/button";
import { ProofEditorView } from "./proof-editor-view";

const meta: Meta<typeof ProofEditorView> = {
  title: "Screens/Proof",
  component: ProofEditorView,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof ProofEditorView>;

const back = (
  <button type="button" className="inline-flex min-h-[var(--size-touch)] items-center text-[13px] text-ink-muted">
    Back
  </button>
);

export const EmptyLog: Story = {
  args: {
    back,
    note: "",
    onNote: () => undefined,
    onLog: () => undefined,
    entries: [],
    question: "",
    draft: null,
  },
};

export const OneQuestion: Story = {
  args: {
    back,
    primary: <Button>Publish</Button>,
    note: "",
    onNote: () => undefined,
    onLog: () => undefined,
    entries: [
      {
        id: "1",
        body: "Saturday close. We ran out of oat milk and I stayed until the last table left.",
        created_at: "2026-08-15T22:00:00Z",
      },
    ],
    question: "What did you do with your own hands when the oat milk ran out?",
    onSkip: () => undefined,
    draft: null,
  },
};

export const Published: Story = {
  args: {
    back,
    primary: <Button>Publish</Button>,
    note: "",
    onNote: () => undefined,
    onLog: () => undefined,
    entries: [
      {
        id: "1",
        body: "Saturday close. We ran out of oat milk and I stayed until the last table left.",
        created_at: "2026-08-15T22:00:00Z",
      },
    ],
    question: "",
    draft: null,
    slug: "saturday-close-abc123",
  },
};

export const Missing: Story = {
  args: {
    missing: true,
    back,
    note: "",
    onNote: () => undefined,
    onLog: () => undefined,
    entries: [],
    question: "",
    draft: null,
  },
};
