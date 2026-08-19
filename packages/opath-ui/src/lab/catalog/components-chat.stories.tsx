import type { Meta, StoryObj } from "@storybook/react-vite";
import { lazy } from "react";
import { LazyFrame } from "./lazy-frame";
const Thinking = lazy(() => import("../beautiful/thinking").then((m) => ({ default: m.Thinking })));
const StreamingText = lazy(() => import("../beautiful/streaming-text").then((m) => ({ default: m.StreamingText })));
const ApprovalCard = lazy(() => import("../beautiful/approval-card").then((m) => ({ default: m.ApprovalCard })));
const ToolChips = lazy(() => import("../beautiful/tool-chips").then((m) => ({ default: m.ToolChips })));
const TaskRows = lazy(() => import("../beautiful/task-rows").then((m) => ({ default: m.TaskRows })));
const Chat = lazy(() => import("../beautiful/chat").then((m) => ({ default: m.Chat })));
const PromptBar = lazy(() => import("../beautiful/prompt-bar").then((m) => ({ default: m.PromptBar })));
const RecommendationCard = lazy(() => import("../beautiful/recommendation-card").then((m) => ({ default: m.RecommendationCard })));
const ContextCards = lazy(() => import("../beautiful/context-cards").then((m) => ({ default: m.ContextCards })));
const Search = lazy(() => import("../beautiful/search").then((m) => ({ default: m.Search })));
const Flowchart = lazy(() => import("../beautiful/flowchart").then((m) => ({ default: m.Flowchart })));
const InsightCards = lazy(() => import("../beautiful/insight-cards").then((m) => ({ default: m.InsightCards })));
const CodeBlockBeautiful = lazy(() => import("../beautiful/code-block").then((m) => ({ default: m.CodeBlockBeautiful })));
const FineTuneCard = lazy(() => import("../beautiful/fine-tune-card").then((m) => ({ default: m.FineTuneCard })));
const OpenInChatCustomLinkDemo = lazy(() => import("../eightstar/examples/open-in-chat-custom-link-demo").then((m) => ({ default: m.default ?? m.OpenInChatCustomLinkDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const OpenInChatCustomProvidersDemo = lazy(() => import("../eightstar/examples/open-in-chat-custom-providers-demo").then((m) => ({ default: m.default ?? m.OpenInChatCustomProvidersDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const OpenInChatCustomTriggerDemo = lazy(() => import("../eightstar/examples/open-in-chat-custom-trigger-demo").then((m) => ({ default: m.default ?? m.OpenInChatCustomTriggerDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const OpenInChatDemo = lazy(() => import("../eightstar/examples/open-in-chat-demo").then((m) => ({ default: m.default ?? m.OpenInChatDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const OpenInChatHorizontalDemo = lazy(() => import("../eightstar/examples/open-in-chat-horizontal-demo").then((m) => ({ default: m.default ?? m.OpenInChatHorizontalDemo ?? Object.values(m).find((v) => typeof v === "function") })));
const OpenInChatPositioningDemo = lazy(() => import("../eightstar/examples/open-in-chat-positioning-demo").then((m) => ({ default: m.default ?? m.OpenInChatPositioningDemo ?? Object.values(m).find((v) => typeof v === "function") })));

const meta = { title: "Lab/Components/Chat" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BeautifulThinking: Story = {
  name: "Thinking",
  render: () => (
    <LazyFrame width={480}>
      <Thinking />
    </LazyFrame>
  ),
};

export const BeautifulStreamingText: Story = {
  name: "Streaming Text",
  render: () => (
    <LazyFrame width={520}>
      <StreamingText />
    </LazyFrame>
  ),
};

export const BeautifulApprovalCard: Story = {
  name: "Approval Card",
  render: () => (
    <LazyFrame>
      <ApprovalCard />
    </LazyFrame>
  ),
};

export const BeautifulToolChips: Story = {
  name: "Tool Chips",
  render: () => (
    <LazyFrame>
      <ToolChips />
    </LazyFrame>
  ),
};

export const BeautifulTaskRows: Story = {
  name: "Task Rows",
  render: () => (
    <LazyFrame width={520}>
      <TaskRows />
    </LazyFrame>
  ),
};

export const BeautifulChat: Story = {
  name: "Chat",
  render: () => (
    <LazyFrame width={480}>
      <Chat />
    </LazyFrame>
  ),
};

export const BeautifulPromptBar: Story = {
  name: "Prompt Bar",
  render: () => (
    <LazyFrame width={480}>
      <PromptBar />
    </LazyFrame>
  ),
};

export const BeautifulRecommendationCard: Story = {
  name: "Recommendation Card",
  render: () => (
    <LazyFrame>
      <RecommendationCard />
    </LazyFrame>
  ),
};

export const BeautifulContextCards: Story = {
  name: "Context Cards",
  render: () => (
    <LazyFrame>
      <ContextCards />
    </LazyFrame>
  ),
};

export const BeautifulSearch: Story = {
  name: "Search",
  render: () => (
    <LazyFrame>
      <Search />
    </LazyFrame>
  ),
};

export const BeautifulFlowchart: Story = {
  name: "Flowchart",
  render: () => (
    <LazyFrame width={520} className="p-3">
      <Flowchart />
    </LazyFrame>
  ),
};

export const BeautifulInsightCards: Story = {
  name: "Insight Cards",
  render: () => (
    <LazyFrame>
      <InsightCards />
    </LazyFrame>
  ),
};

export const BeautifulCodeBlockBeautiful: Story = {
  name: "Code Block",
  render: () => (
    <LazyFrame width={480}>
      <CodeBlockBeautiful />
    </LazyFrame>
  ),
};

export const BeautifulFineTuneCard: Story = {
  name: "Fine-tune Card",
  render: () => (
    <LazyFrame>
      <FineTuneCard />
    </LazyFrame>
  ),
};

export const EightstarOpenInChatCustomLinkDemo: Story = {
  name: "open in chat custom link",
  render: () => (
    <LazyFrame width={640}>
      <OpenInChatCustomLinkDemo />
    </LazyFrame>
  ),
};

export const EightstarOpenInChatCustomProvidersDemo: Story = {
  name: "open in chat custom providers",
  render: () => (
    <LazyFrame width={640}>
      <OpenInChatCustomProvidersDemo />
    </LazyFrame>
  ),
};

export const EightstarOpenInChatCustomTriggerDemo: Story = {
  name: "open in chat custom trigger",
  render: () => (
    <LazyFrame width={640}>
      <OpenInChatCustomTriggerDemo />
    </LazyFrame>
  ),
};

export const EightstarOpenInChatDemo: Story = {
  name: "open in chat",
  render: () => (
    <LazyFrame width={640}>
      <OpenInChatDemo />
    </LazyFrame>
  ),
};

export const EightstarOpenInChatHorizontalDemo: Story = {
  name: "open in chat horizontal",
  render: () => (
    <LazyFrame width={640}>
      <OpenInChatHorizontalDemo />
    </LazyFrame>
  ),
};

export const EightstarOpenInChatPositioningDemo: Story = {
  name: "open in chat positioning",
  render: () => (
    <LazyFrame width={640}>
      <OpenInChatPositioningDemo />
    </LazyFrame>
  ),
};
