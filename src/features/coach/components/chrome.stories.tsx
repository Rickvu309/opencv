import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReasoningPanel, ThinkingCard } from "./thinking";
import { ToolCall, ToolCard, ToolGroup } from "./tool-card";
import { ApprovalCard } from "./approval";
import { ChatMessage } from "./message";
import { CoachComposer } from "./composer";
import { CoachDockPanel, CoachDockPill } from "./dock";
import { CoachSessionProvider } from "./session";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const meta: Meta = { title: "Coach/Chrome" };
export default meta;
type Story = StoryObj;

const demoSteps = [
  {
    title: "Reading the request",
    body: "The user wants drafts restored per thread, so the composer state has to move out of component state.",
  },
  {
    title: "Scope",
    body: "Find the failing path.",
  },
];

export const Thinking: Story = {
  render: () => (
    <div className="w-[28rem]">
      <ReasoningPanel streaming steps={demoSteps} />
    </div>
  ),
};

export const ReasoningSettled: Story = {
  render: () => (
    <div className="w-[28rem]">
      <ReasoningPanel
        streaming={false}
        defaultOpen
        restingLabel="Thought for 4s"
        steps={demoSteps}
      />
    </div>
  ),
};

export const ReasoningFromText: Story = {
  render: () => (
    <div className="w-[28rem]">
      <ThinkingCard
        content={"I am checking the profile.\n\nThen I will draft a CV."}
        isStreaming={false}
        defaultOpen
      />
    </div>
  ),
};

export const ReasoningEmpty: Story = {
  render: () => (
    <div className="w-[28rem]">
      <ReasoningPanel streaming />
    </div>
  ),
};

export const Tool: Story = {
  render: () => (
    <div className="w-[28rem]">
      <ToolCall
        label="Searched"
        activeLabel="Searching"
        query="composer props"
        request='{"q":"composer"}'
        result='{"hits":2}'
        running={false}
        defaultOpen
      />
    </div>
  ),
};

export const ToolRunning: Story = {
  render: () => (
    <div className="w-[28rem]">
      <ToolCall
        label="Searched"
        activeLabel="Searching the docs"
        query="draft persistence"
        request='{"q":"draft persistence"}'
        running
        defaultOpen
      />
    </div>
  ),
};

export const ToolFailed: Story = {
  render: () => (
    <div className="w-[28rem]">
      <ToolCard
        call={{
          id: "2",
          name: "paper.create",
          status: "failed",
          input: { kind: "cv" },
          output: { error: "Could not add the paper" },
        }}
      />
    </div>
  ),
};

export const ToolGroupList: Story = {
  render: () => (
    <div className="w-[28rem]">
      <ToolGroup
        calls={[
          {
            id: "1",
            name: "profile.read",
            status: "completed",
            input: {},
            output: { name: "Linh" },
          },
          {
            id: "2",
            name: "paper.create",
            status: "pending",
            input: { kind: "cv" },
          },
        ]}
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
    <CoachSessionProvider>
      <div className="flex w-[28rem] flex-col gap-3">
        <ChatMessage role="user" text="Build me a CV." />
        <ChatMessage role="coach" text="I drafted a CV from your profile. Open it from Paper." />
        <CoachComposer text="" onText={() => {}} onSend={() => {}} />
      </div>
    </CoachSessionProvider>
  ),
};

export const DockPill: Story = {
  render: () => <CoachDockPill onOpen={() => {}} />,
};

export const DockEmpty: Story = {
  render: () => (
    <CoachSessionProvider>
      <CoachDockPanel onClose={() => {}} onOpenCoach={() => {}}>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1" />
          <div className="shrink-0">
            <CoachComposer compact text="" onText={() => {}} onSend={() => {}} />
          </div>
        </div>
      </CoachDockPanel>
    </CoachSessionProvider>
  ),
};

export const DockWithMessages: Story = {
  render: () => (
    <CoachSessionProvider>
      <CoachDockPanel onClose={() => {}} onOpenCoach={() => {}}>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto py-1">
            <ChatMessage role="user" text="Shorten the experience section." />
            <ChatMessage
              role="coach"
              text="I can tighten that role. Tell me which result to keep."
            />
          </div>
          <div className="shrink-0 pt-2">
            <CoachComposer
              compact
              text=""
              onText={() => {}}
              onSend={() => {}}
              placeholder="Tell me what to change on this page."
            />
          </div>
        </div>
      </CoachDockPanel>
    </CoachSessionProvider>
  ),
};
