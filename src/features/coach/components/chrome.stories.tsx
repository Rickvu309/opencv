import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThinkingCard } from "./thinking";
import { ToolCard } from "./tool-card";
import { ApprovalCard } from "./approval";
import { ChatMessage } from "./message";
import { CoachComposer } from "./composer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const meta: Meta = { title: "Coach/Chrome" };
export default meta;
type Story = StoryObj;

export const Thinking: Story = {
  render: () => (
    <div className="w-[28rem]">
      <ThinkingCard content={"I am checking the profile.\n\nThen I will draft a CV."} isStreaming />
    </div>
  ),
};

export const Tool: Story = {
  render: () => (
    <div className="w-[28rem]">
      <ToolCard
        call={{
          id: "1",
          name: "paper.create",
          status: "completed",
          input: { kind: "cv" },
          output: { id: "p1" },
        }}
      />
    </div>
  ),
};

export const Approval: Story = {
  render: () => (
    <QueryClientProvider client={new QueryClient()}>
      <div className="w-[28rem]">
        <ApprovalCard
          approval={{
            command: "paper.remove",
            input: { id: "p1" },
            description: "Delete a paper",
          }}
        />
      </div>
    </QueryClientProvider>
  ),
};

export const MessageAndComposer: Story = {
  render: () => (
    <div className="flex w-[28rem] flex-col gap-3">
      <ChatMessage role="user" text="Build me a CV." />
      <ChatMessage role="coach" text="I drafted a CV from your profile. Open it from Paper." />
      <CoachComposer text="" onText={() => {}} onSend={() => {}} />
    </div>
  ),
};
