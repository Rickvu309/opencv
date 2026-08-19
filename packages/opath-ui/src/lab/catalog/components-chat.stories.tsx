import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";
import { Thinking } from "../beautiful/thinking";
import { StreamingText } from "../beautiful/streaming-text";
import { ApprovalCard } from "../beautiful/approval-card";
import { ToolChips } from "../beautiful/tool-chips";
import { TaskRows } from "../beautiful/task-rows";
import { Chat } from "../beautiful/chat";
import { PromptBar } from "../beautiful/prompt-bar";
import { RecommendationCard } from "../beautiful/recommendation-card";
import { ContextCards } from "../beautiful/context-cards";
import { Search } from "../beautiful/search";
import { Flowchart } from "../beautiful/flowchart";
import { InsightCards } from "../beautiful/insight-cards";
import { CodeBlockBeautiful } from "../beautiful/code-block";
import { FineTuneCard } from "../beautiful/fine-tune-card";
import OpenInChatCustomLinkDemo from "../eightstar/examples/open-in-chat-custom-link-demo";
import OpenInChatCustomProvidersDemo from "../eightstar/examples/open-in-chat-custom-providers-demo";
import OpenInChatCustomTriggerDemo from "../eightstar/examples/open-in-chat-custom-trigger-demo";
import OpenInChatDemo from "../eightstar/examples/open-in-chat-demo";
import OpenInChatHorizontalDemo from "../eightstar/examples/open-in-chat-horizontal-demo";
import OpenInChatPositioningDemo from "../eightstar/examples/open-in-chat-positioning-demo";

const meta = { title: "Lab/Components/Chat" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BeautifulThinking: Story = {
  name: "Thinking",
  render: () => (
    <StoryFrame width={480}>
      <Thinking />
    </StoryFrame>
  ),
};

export const BeautifulStreamingText: Story = {
  name: "Streaming Text",
  render: () => (
    <StoryFrame width={520}>
      <StreamingText />
    </StoryFrame>
  ),
};

export const BeautifulApprovalCard: Story = {
  name: "Approval Card",
  render: () => (
    <StoryFrame>
      <ApprovalCard />
    </StoryFrame>
  ),
};

export const BeautifulToolChips: Story = {
  name: "Tool Chips",
  render: () => (
    <StoryFrame>
      <ToolChips />
    </StoryFrame>
  ),
};

export const BeautifulTaskRows: Story = {
  name: "Task Rows",
  render: () => (
    <StoryFrame width={520}>
      <TaskRows />
    </StoryFrame>
  ),
};

export const BeautifulChat: Story = {
  name: "Chat",
  render: () => (
    <StoryFrame width={480}>
      <Chat />
    </StoryFrame>
  ),
};

export const BeautifulPromptBar: Story = {
  name: "Prompt Bar",
  render: () => (
    <StoryFrame width={480}>
      <PromptBar />
    </StoryFrame>
  ),
};

export const BeautifulRecommendationCard: Story = {
  name: "Recommendation Card",
  render: () => (
    <StoryFrame>
      <RecommendationCard />
    </StoryFrame>
  ),
};

export const BeautifulContextCards: Story = {
  name: "Context Cards",
  render: () => (
    <StoryFrame>
      <ContextCards />
    </StoryFrame>
  ),
};

export const BeautifulSearch: Story = {
  name: "Search",
  render: () => (
    <StoryFrame>
      <Search />
    </StoryFrame>
  ),
};

export const BeautifulFlowchart: Story = {
  name: "Flowchart",
  render: () => (
    <StoryFrame width={520} className="p-3">
      <Flowchart />
    </StoryFrame>
  ),
};

export const BeautifulInsightCards: Story = {
  name: "Insight Cards",
  render: () => (
    <StoryFrame>
      <InsightCards />
    </StoryFrame>
  ),
};

export const BeautifulCodeBlockBeautiful: Story = {
  name: "Code Block",
  render: () => (
    <StoryFrame width={480}>
      <CodeBlockBeautiful />
    </StoryFrame>
  ),
};

export const BeautifulFineTuneCard: Story = {
  name: "Fine-tune Card",
  render: () => (
    <StoryFrame>
      <FineTuneCard />
    </StoryFrame>
  ),
};

export const EightstarOpenInChatCustomLinkDemo: Story = {
  name: "open in chat custom link",
  render: () => (
    <StoryFrame width={640}>
      <OpenInChatCustomLinkDemo />
    </StoryFrame>
  ),
};

export const EightstarOpenInChatCustomProvidersDemo: Story = {
  name: "open in chat custom providers",
  render: () => (
    <StoryFrame width={640}>
      <OpenInChatCustomProvidersDemo />
    </StoryFrame>
  ),
};

export const EightstarOpenInChatCustomTriggerDemo: Story = {
  name: "open in chat custom trigger",
  render: () => (
    <StoryFrame width={640}>
      <OpenInChatCustomTriggerDemo />
    </StoryFrame>
  ),
};

export const EightstarOpenInChatDemo: Story = {
  name: "open in chat",
  render: () => (
    <StoryFrame width={640}>
      <OpenInChatDemo />
    </StoryFrame>
  ),
};

export const EightstarOpenInChatHorizontalDemo: Story = {
  name: "open in chat horizontal",
  render: () => (
    <StoryFrame width={640}>
      <OpenInChatHorizontalDemo />
    </StoryFrame>
  ),
};

export const EightstarOpenInChatPositioningDemo: Story = {
  name: "open in chat positioning",
  render: () => (
    <StoryFrame width={640}>
      <OpenInChatPositioningDemo />
    </StoryFrame>
  ),
};
