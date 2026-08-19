import type { Meta, StoryObj } from "@storybook/react-vite";
import { lazy } from "react";
import { LazyFrame } from "./lazy-frame";
const FileUpload01 = lazy(() => import("../blocks-so/file-upload-01/file-upload-01").then((m) => ({ default: m.default ?? m.FileUpload01 ?? Object.values(m).find((v) => typeof v === "function") })));
const FileUpload02 = lazy(() => import("../blocks-so/file-upload-02/file-upload-02").then((m) => ({ default: m.default ?? m.FileUpload02 ?? Object.values(m).find((v) => typeof v === "function") })));
const FileUpload03 = lazy(() => import("../blocks-so/file-upload-03/file-upload-03").then((m) => ({ default: m.default ?? m.FileUpload03 ?? Object.values(m).find((v) => typeof v === "function") })));
const FileUpload04 = lazy(() => import("../blocks-so/file-upload-04/file-upload-04").then((m) => ({ default: m.default ?? m.FileUpload04 ?? Object.values(m).find((v) => typeof v === "function") })));
const FileUpload05 = lazy(() => import("../blocks-so/file-upload-05/file-upload-05").then((m) => ({ default: m.default ?? m.FileUpload05 ?? Object.values(m).find((v) => typeof v === "function") })));
const FileUpload06 = lazy(() => import("../blocks-so/file-upload-06/file-upload-06").then((m) => ({ default: m.default ?? m.FileUpload06 ?? Object.values(m).find((v) => typeof v === "function") })));
const FormLayout01 = lazy(() => import("../blocks-so/form-layout-01/form-layout-01").then((m) => ({ default: m.default ?? m.FormLayout01 ?? Object.values(m).find((v) => typeof v === "function") })));
const FormLayout02 = lazy(() => import("../blocks-so/form-layout-02/form-layout-02").then((m) => ({ default: m.default ?? m.FormLayout02 ?? Object.values(m).find((v) => typeof v === "function") })));
const FormLayout03 = lazy(() => import("../blocks-so/form-layout-03/form-layout-03").then((m) => ({ default: m.default ?? m.FormLayout03 ?? Object.values(m).find((v) => typeof v === "function") })));
const FormLayout04 = lazy(() => import("../blocks-so/form-layout-04/form-layout-04").then((m) => ({ default: m.default ?? m.FormLayout04 ?? Object.values(m).find((v) => typeof v === "function") })));
const FormLayout05 = lazy(() => import("../blocks-so/form-layout-05/form-layout-05").then((m) => ({ default: m.default ?? m.FormLayout05 ?? Object.values(m).find((v) => typeof v === "function") })));
const GridList01 = lazy(() => import("../blocks-so/grid-list-01/grid-list-01").then((m) => ({ default: m.default ?? m.GridList01 ?? Object.values(m).find((v) => typeof v === "function") })));
const GridList02 = lazy(() => import("../blocks-so/grid-list-02/grid-list-02").then((m) => ({ default: m.default ?? m.GridList02 ?? Object.values(m).find((v) => typeof v === "function") })));
const GridList03 = lazy(() => import("../blocks-so/grid-list-03/grid-list-03").then((m) => ({ default: m.default ?? m.GridList03 ?? Object.values(m).find((v) => typeof v === "function") })));
const Sidebar01 = lazy(() => import("../blocks-so/sidebar-01/index").then((m) => ({ default: m.default ?? m.Sidebar01 ?? Object.values(m).find((v) => typeof v === "function") })));
const Sidebar02 = lazy(() => import("../blocks-so/sidebar-02/index").then((m) => ({ default: m.default ?? m.Sidebar02 ?? Object.values(m).find((v) => typeof v === "function") })));
const Sidebar03 = lazy(() => import("../blocks-so/sidebar-03/index").then((m) => ({ default: m.default ?? m.Sidebar03 ?? Object.values(m).find((v) => typeof v === "function") })));
const Sidebar04 = lazy(() => import("../blocks-so/sidebar-04/nav-user").then((m) => ({ default: m.default ?? m.Sidebar04 ?? Object.values(m).find((v) => typeof v === "function") })));
const Sidebar05 = lazy(() => import("../blocks-so/sidebar-05/team-switcher").then((m) => ({ default: m.default ?? m.Sidebar05 ?? Object.values(m).find((v) => typeof v === "function") })));
const Sidebar06 = lazy(() => import("../blocks-so/sidebar-06/team-switcher").then((m) => ({ default: m.default ?? m.Sidebar06 ?? Object.values(m).find((v) => typeof v === "function") })));
const Stats01 = lazy(() => import("../blocks-so/stats-01/stats-01").then((m) => ({ default: m.default ?? m.Stats01 ?? Object.values(m).find((v) => typeof v === "function") })));
const Stats02 = lazy(() => import("../blocks-so/stats-02/stats-02").then((m) => ({ default: m.default ?? m.Stats02 ?? Object.values(m).find((v) => typeof v === "function") })));
const Stats03 = lazy(() => import("../blocks-so/stats-03/stats-03").then((m) => ({ default: m.default ?? m.Stats03 ?? Object.values(m).find((v) => typeof v === "function") })));
const Stats04 = lazy(() => import("../blocks-so/stats-04/stats-04").then((m) => ({ default: m.default ?? m.Stats04 ?? Object.values(m).find((v) => typeof v === "function") })));
const Stats05 = lazy(() => import("../blocks-so/stats-05/stats-05").then((m) => ({ default: m.default ?? m.Stats05 ?? Object.values(m).find((v) => typeof v === "function") })));
const Stats06 = lazy(() => import("../blocks-so/stats-06/stats-06").then((m) => ({ default: m.default ?? m.Stats06 ?? Object.values(m).find((v) => typeof v === "function") })));
const Stats07 = lazy(() => import("../blocks-so/stats-07/stats-07").then((m) => ({ default: m.default ?? m.Stats07 ?? Object.values(m).find((v) => typeof v === "function") })));
const Stats08 = lazy(() => import("../blocks-so/stats-08/stats-08").then((m) => ({ default: m.default ?? m.Stats08 ?? Object.values(m).find((v) => typeof v === "function") })));
const Stats09 = lazy(() => import("../blocks-so/stats-09/stats-09").then((m) => ({ default: m.default ?? m.Stats09 ?? Object.values(m).find((v) => typeof v === "function") })));
const Stats10 = lazy(() => import("../blocks-so/stats-10/stats-10").then((m) => ({ default: m.default ?? m.Stats10 ?? Object.values(m).find((v) => typeof v === "function") })));
const Stats11 = lazy(() => import("../blocks-so/stats-11/stats-11").then((m) => ({ default: m.default ?? m.Stats11 ?? Object.values(m).find((v) => typeof v === "function") })));
const Stats12 = lazy(() => import("../blocks-so/stats-12/stats-12").then((m) => ({ default: m.default ?? m.Stats12 ?? Object.values(m).find((v) => typeof v === "function") })));
const Stats13 = lazy(() => import("../blocks-so/stats-13/stats-13").then((m) => ({ default: m.default ?? m.Stats13 ?? Object.values(m).find((v) => typeof v === "function") })));
const Stats14 = lazy(() => import("../blocks-so/stats-14/stats-14").then((m) => ({ default: m.default ?? m.Stats14 ?? Object.values(m).find((v) => typeof v === "function") })));
const Stats15 = lazy(() => import("../blocks-so/stats-15/stats-15").then((m) => ({ default: m.default ?? m.Stats15 ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Codebase = lazy(() => import("../kibo/_examples/codebase").then((m) => ({ default: m.default ?? m.Example_Codebase ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CollaborativeCanvas = lazy(() => import("../kibo/_examples/collaborative-canvas").then((m) => ({ default: m.default ?? m.Example_CollaborativeCanvas ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_GanttLanes = lazy(() => import("../kibo/_examples/gantt-lanes").then((m) => ({ default: m.default ?? m.Example_GanttLanes ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_GanttNoSidebar = lazy(() => import("../kibo/_examples/gantt-no-sidebar").then((m) => ({ default: m.default ?? m.Example_GanttNoSidebar ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_GanttReadOnly = lazy(() => import("../kibo/_examples/gantt-read-only").then((m) => ({ default: m.default ?? m.Example_GanttReadOnly ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Gantt = lazy(() => import("../kibo/_examples/gantt").then((m) => ({ default: m.default ?? m.Example_Gantt ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_KanbanSimple = lazy(() => import("../kibo/_examples/kanban-simple").then((m) => ({ default: m.default ?? m.Example_KanbanSimple ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Kanban = lazy(() => import("../kibo/_examples/kanban").then((m) => ({ default: m.default ?? m.Example_Kanban ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ListSimple = lazy(() => import("../kibo/_examples/list-simple").then((m) => ({ default: m.default ?? m.Example_ListSimple ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_List = lazy(() => import("../kibo/_examples/list").then((m) => ({ default: m.default ?? m.Example_List ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Roadmap = lazy(() => import("../kibo/_examples/roadmap").then((m) => ({ default: m.default ?? m.Example_Roadmap ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_SandboxNoFileExplorer = lazy(() => import("../kibo/_examples/sandbox-no-file-explorer").then((m) => ({ default: m.default ?? m.Example_SandboxNoFileExplorer ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Sandbox = lazy(() => import("../kibo/_examples/sandbox").then((m) => ({ default: m.default ?? m.Example_Sandbox ?? Object.values(m).find((v) => typeof v === "function") })));

const meta = { title: "Lab/Templates/Application" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BlockFileUpload01: Story = {
  name: "file-upload-01",
  render: () => (
    <LazyFrame width={720}>
      <FileUpload01 />
    </LazyFrame>
  ),
};

export const BlockFileUpload02: Story = {
  name: "file-upload-02",
  render: () => (
    <LazyFrame width={720}>
      <FileUpload02 />
    </LazyFrame>
  ),
};

export const BlockFileUpload03: Story = {
  name: "file-upload-03",
  render: () => (
    <LazyFrame width={720}>
      <FileUpload03 />
    </LazyFrame>
  ),
};

export const BlockFileUpload04: Story = {
  name: "file-upload-04",
  render: () => (
    <LazyFrame width={720}>
      <FileUpload04 />
    </LazyFrame>
  ),
};

export const BlockFileUpload05: Story = {
  name: "file-upload-05",
  render: () => (
    <LazyFrame width={720}>
      <FileUpload05 />
    </LazyFrame>
  ),
};

export const BlockFileUpload06: Story = {
  name: "file-upload-06",
  render: () => (
    <LazyFrame width={720}>
      <FileUpload06 />
    </LazyFrame>
  ),
};

export const BlockFormLayout01: Story = {
  name: "form-layout-01",
  render: () => (
    <LazyFrame width={720}>
      <FormLayout01 />
    </LazyFrame>
  ),
};

export const BlockFormLayout02: Story = {
  name: "form-layout-02",
  render: () => (
    <LazyFrame width={720}>
      <FormLayout02 />
    </LazyFrame>
  ),
};

export const BlockFormLayout03: Story = {
  name: "form-layout-03",
  render: () => (
    <LazyFrame width={720}>
      <FormLayout03 />
    </LazyFrame>
  ),
};

export const BlockFormLayout04: Story = {
  name: "form-layout-04",
  render: () => (
    <LazyFrame width={720}>
      <FormLayout04 />
    </LazyFrame>
  ),
};

export const BlockFormLayout05: Story = {
  name: "form-layout-05",
  render: () => (
    <LazyFrame width={720}>
      <FormLayout05 />
    </LazyFrame>
  ),
};

export const BlockGridList01: Story = {
  name: "grid-list-01",
  render: () => (
    <LazyFrame width={720}>
      <GridList01 />
    </LazyFrame>
  ),
};

export const BlockGridList02: Story = {
  name: "grid-list-02",
  render: () => (
    <LazyFrame width={720}>
      <GridList02 />
    </LazyFrame>
  ),
};

export const BlockGridList03: Story = {
  name: "grid-list-03",
  render: () => (
    <LazyFrame width={720}>
      <GridList03 />
    </LazyFrame>
  ),
};

export const BlockSidebar01: Story = {
  name: "sidebar-01",
  render: () => (
    <LazyFrame width={720}>
      <Sidebar01 />
    </LazyFrame>
  ),
};

export const BlockSidebar02: Story = {
  name: "sidebar-02",
  render: () => (
    <LazyFrame width={720}>
      <Sidebar02 />
    </LazyFrame>
  ),
};

export const BlockSidebar03: Story = {
  name: "sidebar-03",
  render: () => (
    <LazyFrame width={720}>
      <Sidebar03 />
    </LazyFrame>
  ),
};

export const BlockSidebar04: Story = {
  name: "sidebar-04",
  render: () => (
    <LazyFrame width={720}>
      <Sidebar04 />
    </LazyFrame>
  ),
};

export const BlockSidebar05: Story = {
  name: "sidebar-05",
  render: () => (
    <LazyFrame width={720}>
      <Sidebar05 />
    </LazyFrame>
  ),
};

export const BlockSidebar06: Story = {
  name: "sidebar-06",
  render: () => (
    <LazyFrame width={720}>
      <Sidebar06 />
    </LazyFrame>
  ),
};

export const BlockStats01: Story = {
  name: "stats-01",
  render: () => (
    <LazyFrame width={720}>
      <Stats01 />
    </LazyFrame>
  ),
};

export const BlockStats02: Story = {
  name: "stats-02",
  render: () => (
    <LazyFrame width={720}>
      <Stats02 />
    </LazyFrame>
  ),
};

export const BlockStats03: Story = {
  name: "stats-03",
  render: () => (
    <LazyFrame width={720}>
      <Stats03 />
    </LazyFrame>
  ),
};

export const BlockStats04: Story = {
  name: "stats-04",
  render: () => (
    <LazyFrame width={720}>
      <Stats04 />
    </LazyFrame>
  ),
};

export const BlockStats05: Story = {
  name: "stats-05",
  render: () => (
    <LazyFrame width={720}>
      <Stats05 />
    </LazyFrame>
  ),
};

export const BlockStats06: Story = {
  name: "stats-06",
  render: () => (
    <LazyFrame width={720}>
      <Stats06 />
    </LazyFrame>
  ),
};

export const BlockStats07: Story = {
  name: "stats-07",
  render: () => (
    <LazyFrame width={720}>
      <Stats07 />
    </LazyFrame>
  ),
};

export const BlockStats08: Story = {
  name: "stats-08",
  render: () => (
    <LazyFrame width={720}>
      <Stats08 />
    </LazyFrame>
  ),
};

export const BlockStats09: Story = {
  name: "stats-09",
  render: () => (
    <LazyFrame width={720}>
      <Stats09 />
    </LazyFrame>
  ),
};

export const BlockStats10: Story = {
  name: "stats-10",
  render: () => (
    <LazyFrame width={720}>
      <Stats10 />
    </LazyFrame>
  ),
};

export const BlockStats11: Story = {
  name: "stats-11",
  render: () => (
    <LazyFrame width={720}>
      <Stats11 />
    </LazyFrame>
  ),
};

export const BlockStats12: Story = {
  name: "stats-12",
  render: () => (
    <LazyFrame width={720}>
      <Stats12 />
    </LazyFrame>
  ),
};

export const BlockStats13: Story = {
  name: "stats-13",
  render: () => (
    <LazyFrame width={720}>
      <Stats13 />
    </LazyFrame>
  ),
};

export const BlockStats14: Story = {
  name: "stats-14",
  render: () => (
    <LazyFrame width={720}>
      <Stats14 />
    </LazyFrame>
  ),
};

export const BlockStats15: Story = {
  name: "stats-15",
  render: () => (
    <LazyFrame width={720}>
      <Stats15 />
    </LazyFrame>
  ),
};

export const KiboCodebase: Story = {
  name: "codebase",
  render: () => (
    <LazyFrame width={720}>
      <Example_Codebase />
    </LazyFrame>
  ),
};

export const KiboCollaborativeCanvas: Story = {
  name: "collaborative canvas",
  render: () => (
    <LazyFrame width={720}>
      <Example_CollaborativeCanvas />
    </LazyFrame>
  ),
};

export const KiboGanttLanes: Story = {
  name: "gantt lanes",
  render: () => (
    <LazyFrame width={720}>
      <Example_GanttLanes />
    </LazyFrame>
  ),
};

export const KiboGanttNoSidebar: Story = {
  name: "gantt no sidebar",
  render: () => (
    <LazyFrame width={720}>
      <Example_GanttNoSidebar />
    </LazyFrame>
  ),
};

export const KiboGanttReadOnly: Story = {
  name: "gantt read only",
  render: () => (
    <LazyFrame width={720}>
      <Example_GanttReadOnly />
    </LazyFrame>
  ),
};

export const KiboGantt: Story = {
  name: "gantt",
  render: () => (
    <LazyFrame width={720}>
      <Example_Gantt />
    </LazyFrame>
  ),
};

export const KiboKanbanSimple: Story = {
  name: "kanban simple",
  render: () => (
    <LazyFrame width={720}>
      <Example_KanbanSimple />
    </LazyFrame>
  ),
};

export const KiboKanban: Story = {
  name: "kanban",
  render: () => (
    <LazyFrame width={720}>
      <Example_Kanban />
    </LazyFrame>
  ),
};

export const KiboListSimple: Story = {
  name: "list simple",
  render: () => (
    <LazyFrame width={720}>
      <Example_ListSimple />
    </LazyFrame>
  ),
};

export const KiboList: Story = {
  name: "list",
  render: () => (
    <LazyFrame width={720}>
      <Example_List />
    </LazyFrame>
  ),
};

export const KiboRoadmap: Story = {
  name: "roadmap",
  render: () => (
    <LazyFrame width={720}>
      <Example_Roadmap />
    </LazyFrame>
  ),
};

export const KiboSandboxNoFileExplorer: Story = {
  name: "sandbox no file explorer",
  render: () => (
    <LazyFrame width={720}>
      <Example_SandboxNoFileExplorer />
    </LazyFrame>
  ),
};

export const KiboSandbox: Story = {
  name: "sandbox",
  render: () => (
    <LazyFrame width={720}>
      <Example_Sandbox />
    </LazyFrame>
  ),
};
