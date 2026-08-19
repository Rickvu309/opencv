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
    title: "Weekend batch",
    back,
    meta: "The story still needs what it was.",
    primary: <Button>Arrange</Button>,
    note: "",
    onNote: () => undefined,
    onLog: () => undefined,
    entries: [],
    question: "",
    onAsk: () => undefined,
    draft: null,
  },
};

export const Arranged: Story = {
  args: {
    title: "Weekend batch",
    back,
    meta: "The story is arranged.",
    primary: <Button>Publish</Button>,
    note: "",
    onNote: () => undefined,
    onLog: () => undefined,
    entries: [
      { id: "1", body: "Two people called out on Saturday.", created_at: "2026-08-01T10:00:00Z" },
      { id: "2", body: "I wrote a one-page runbook.", created_at: "2026-08-02T10:00:00Z" },
    ],
    question: "What changed the next weekend?",
    onAsk: () => undefined,
    draft: {
      what: "The weekend batch slipped when two people called out.",
      did: "I split the remaining work and wrote a one-page runbook.",
      came: "The batch finished on time the next weekend.",
    },
    slug: "weekend-batch",
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
    onAsk: () => undefined,
    draft: null,
  },
};
