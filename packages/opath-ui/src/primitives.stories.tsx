import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Chip } from "./chip";
import { Card, EmptyMessageCard, EndOfList } from "./card";
import { Switch } from "./switch";
import { Checkbox } from "./checkbox";
import { Code } from "./code";
import { Loader } from "./loader";
import { Keycap } from "./keycap";
import { InfoBlock } from "./info-block";
import { Interactive } from "./interactive";
import { SkeletonRows, SkeletonHistory, SkeletonPage } from "./skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { DataTable, createColumnHelper } from "./table";
import { Tooltip } from "./tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";

const meta: Meta = {
  title: "Primitives/Gallery",
};
export default meta;

type Story = StoryObj;

export const Buttons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button>Primary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Delete</Button>
      <Button size="sm">Small</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const Chips: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Chip>Quiet</Chip>
      <Chip tone="status" status="progress">
        Interviewing
      </Chip>
      <Chip tone="status" status="positive">
        Published
      </Chip>
      <Chip tone="code">paper.create</Chip>
    </div>
  ),
};

export const Surfaces: Story = {
  render: () => (
    <div className="flex w-[28rem] flex-col gap-3">
      <Card>
        <p className="text-[15px] font-[510]">Artifact</p>
        <p className="mt-1 text-[13px] text-ink-muted">CV · Analyst</p>
      </Card>
      <EmptyMessageCard title="Nothing in this thread yet." />
      <InfoBlock>The Coach is offline right now. Everything else in the app still works.</InfoBlock>
      <Code value="npm run storybook">npm run storybook</Code>
      <div className="flex items-center gap-3">
        <Loader />
        <Switch aria-label="Email me before deadlines" />
        <Checkbox aria-label="Done" />
        <Keycap>Enter</Keycap>
      </div>
      <Interactive>Rail item</Interactive>
      <Interactive state="selected">Active rail item</Interactive>
      <EndOfList />
    </div>
  ),
};

export const Skeletons: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="w-[28rem] space-y-6">
      <SkeletonRows count={3} />
      <SkeletonHistory count={4} />
      <SkeletonPage />
    </div>
  ),
};

export const TabsTooltipCollapsible: Story = {
  render: () => (
    <div className="flex w-[28rem] flex-col gap-4">
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
        <TabsContent value="one" className="pt-2 text-[13px]">
          First panel
        </TabsContent>
        <TabsContent value="two" className="pt-2 text-[13px]">
          Second panel
        </TabsContent>
      </Tabs>
      <Tooltip tooltip="A short explanation">
        <button type="button" className="text-[13px] text-accent underline">
          Hover for a tip
        </button>
      </Tooltip>
      <Collapsible>
        <CollapsibleTrigger className="text-[13px]">Show more</CollapsibleTrigger>
        <CollapsibleContent className="pt-2 text-[13px] text-ink-muted">
          Hidden until opened.
        </CollapsibleContent>
      </Collapsible>
    </div>
  ),
};

const tableHelper = createColumnHelper<{ role: string; company: string }>();

export const Table: Story = {
  render: () => (
    <div className="w-[32rem]">
      <DataTable
        columns={[
          tableHelper.accessor("role", { header: "Role" }),
          tableHelper.accessor("company", { header: "Company" }),
        ]}
        data={[
          { role: "Analyst", company: "Vietcombank" },
          { role: "Intern", company: "Grab" },
        ]}
      />
    </div>
  ),
};
