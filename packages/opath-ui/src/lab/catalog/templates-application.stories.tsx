import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";
import FileUpload01 from "../blocks-so/file-upload-01/file-upload-01";
import FileUpload02 from "../blocks-so/file-upload-02/file-upload-02";
import FileUpload03 from "../blocks-so/file-upload-03/file-upload-03";
import FileUpload04 from "../blocks-so/file-upload-04/file-upload-04";
import FileUpload05 from "../blocks-so/file-upload-05/file-upload-05";
import FileUpload06 from "../blocks-so/file-upload-06/file-upload-06";
import FormLayout01 from "../blocks-so/form-layout-01/form-layout-01";
import FormLayout02 from "../blocks-so/form-layout-02/form-layout-02";
import FormLayout03 from "../blocks-so/form-layout-03/form-layout-03";
import FormLayout04 from "../blocks-so/form-layout-04/form-layout-04";
import FormLayout05 from "../blocks-so/form-layout-05/form-layout-05";
import GridList01 from "../blocks-so/grid-list-01/grid-list-01";
import GridList02 from "../blocks-so/grid-list-02/grid-list-02";
import GridList03 from "../blocks-so/grid-list-03/grid-list-03";
import Sidebar01 from "../blocks-so/sidebar-01/index";
import Sidebar02 from "../blocks-so/sidebar-02/index";
import Sidebar03 from "../blocks-so/sidebar-03/index";
import Sidebar04 from "../blocks-so/sidebar-04/nav-user";
import Sidebar05 from "../blocks-so/sidebar-05/team-switcher";
import Sidebar06 from "../blocks-so/sidebar-06/team-switcher";
import Stats01 from "../blocks-so/stats-01/stats-01";
import Stats02 from "../blocks-so/stats-02/stats-02";
import Stats03 from "../blocks-so/stats-03/stats-03";
import Stats04 from "../blocks-so/stats-04/stats-04";
import Stats05 from "../blocks-so/stats-05/stats-05";
import Stats06 from "../blocks-so/stats-06/stats-06";
import Stats07 from "../blocks-so/stats-07/stats-07";
import Stats08 from "../blocks-so/stats-08/stats-08";
import Stats09 from "../blocks-so/stats-09/stats-09";
import Stats10 from "../blocks-so/stats-10/stats-10";
import Stats11 from "../blocks-so/stats-11/stats-11";
import Stats12 from "../blocks-so/stats-12/stats-12";
import Stats13 from "../blocks-so/stats-13/stats-13";
import Stats14 from "../blocks-so/stats-14/stats-14";
import Stats15 from "../blocks-so/stats-15/stats-15";
import Example_Codebase from "../kibo/_examples/codebase";
import Example_CollaborativeCanvas from "../kibo/_examples/collaborative-canvas";
import Example_GanttLanes from "../kibo/_examples/gantt-lanes";
import Example_GanttNoSidebar from "../kibo/_examples/gantt-no-sidebar";
import Example_GanttReadOnly from "../kibo/_examples/gantt-read-only";
import Example_Gantt from "../kibo/_examples/gantt";
import Example_KanbanSimple from "../kibo/_examples/kanban-simple";
import Example_Kanban from "../kibo/_examples/kanban";
import Example_ListSimple from "../kibo/_examples/list-simple";
import Example_List from "../kibo/_examples/list";
import Example_Roadmap from "../kibo/_examples/roadmap";
import Example_SandboxNoFileExplorer from "../kibo/_examples/sandbox-no-file-explorer";
import Example_Sandbox from "../kibo/_examples/sandbox";

const meta = { title: "Lab/Templates/Application" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BlockFileUpload01: Story = {
  name: "file-upload-01",
  render: () => (
    <StoryFrame width={720}>
      <FileUpload01 />
    </StoryFrame>
  ),
};

export const BlockFileUpload02: Story = {
  name: "file-upload-02",
  render: () => (
    <StoryFrame width={720}>
      <FileUpload02 />
    </StoryFrame>
  ),
};

export const BlockFileUpload03: Story = {
  name: "file-upload-03",
  render: () => (
    <StoryFrame width={720}>
      <FileUpload03 />
    </StoryFrame>
  ),
};

export const BlockFileUpload04: Story = {
  name: "file-upload-04",
  render: () => (
    <StoryFrame width={720}>
      <FileUpload04 />
    </StoryFrame>
  ),
};

export const BlockFileUpload05: Story = {
  name: "file-upload-05",
  render: () => (
    <StoryFrame width={720}>
      <FileUpload05 />
    </StoryFrame>
  ),
};

export const BlockFileUpload06: Story = {
  name: "file-upload-06",
  render: () => (
    <StoryFrame width={720}>
      <FileUpload06 />
    </StoryFrame>
  ),
};

export const BlockFormLayout01: Story = {
  name: "form-layout-01",
  render: () => (
    <StoryFrame width={720}>
      <FormLayout01 />
    </StoryFrame>
  ),
};

export const BlockFormLayout02: Story = {
  name: "form-layout-02",
  render: () => (
    <StoryFrame width={720}>
      <FormLayout02 />
    </StoryFrame>
  ),
};

export const BlockFormLayout03: Story = {
  name: "form-layout-03",
  render: () => (
    <StoryFrame width={720}>
      <FormLayout03 />
    </StoryFrame>
  ),
};

export const BlockFormLayout04: Story = {
  name: "form-layout-04",
  render: () => (
    <StoryFrame width={720}>
      <FormLayout04 />
    </StoryFrame>
  ),
};

export const BlockFormLayout05: Story = {
  name: "form-layout-05",
  render: () => (
    <StoryFrame width={720}>
      <FormLayout05 />
    </StoryFrame>
  ),
};

export const BlockGridList01: Story = {
  name: "grid-list-01",
  render: () => (
    <StoryFrame width={720}>
      <GridList01 />
    </StoryFrame>
  ),
};

export const BlockGridList02: Story = {
  name: "grid-list-02",
  render: () => (
    <StoryFrame width={720}>
      <GridList02 />
    </StoryFrame>
  ),
};

export const BlockGridList03: Story = {
  name: "grid-list-03",
  render: () => (
    <StoryFrame width={720}>
      <GridList03 />
    </StoryFrame>
  ),
};

export const BlockSidebar01: Story = {
  name: "sidebar-01",
  render: () => (
    <StoryFrame width={720}>
      <Sidebar01 />
    </StoryFrame>
  ),
};

export const BlockSidebar02: Story = {
  name: "sidebar-02",
  render: () => (
    <StoryFrame width={720}>
      <Sidebar02 />
    </StoryFrame>
  ),
};

export const BlockSidebar03: Story = {
  name: "sidebar-03",
  render: () => (
    <StoryFrame width={720}>
      <Sidebar03 />
    </StoryFrame>
  ),
};

export const BlockSidebar04: Story = {
  name: "sidebar-04",
  render: () => (
    <StoryFrame width={720}>
      <Sidebar04 />
    </StoryFrame>
  ),
};

export const BlockSidebar05: Story = {
  name: "sidebar-05",
  render: () => (
    <StoryFrame width={720}>
      <Sidebar05 />
    </StoryFrame>
  ),
};

export const BlockSidebar06: Story = {
  name: "sidebar-06",
  render: () => (
    <StoryFrame width={720}>
      <Sidebar06 />
    </StoryFrame>
  ),
};

export const BlockStats01: Story = {
  name: "stats-01",
  render: () => (
    <StoryFrame width={720}>
      <Stats01 />
    </StoryFrame>
  ),
};

export const BlockStats02: Story = {
  name: "stats-02",
  render: () => (
    <StoryFrame width={720}>
      <Stats02 />
    </StoryFrame>
  ),
};

export const BlockStats03: Story = {
  name: "stats-03",
  render: () => (
    <StoryFrame width={720}>
      <Stats03 />
    </StoryFrame>
  ),
};

export const BlockStats04: Story = {
  name: "stats-04",
  render: () => (
    <StoryFrame width={720}>
      <Stats04 />
    </StoryFrame>
  ),
};

export const BlockStats05: Story = {
  name: "stats-05",
  render: () => (
    <StoryFrame width={720}>
      <Stats05 />
    </StoryFrame>
  ),
};

export const BlockStats06: Story = {
  name: "stats-06",
  render: () => (
    <StoryFrame width={720}>
      <Stats06 />
    </StoryFrame>
  ),
};

export const BlockStats07: Story = {
  name: "stats-07",
  render: () => (
    <StoryFrame width={720}>
      <Stats07 />
    </StoryFrame>
  ),
};

export const BlockStats08: Story = {
  name: "stats-08",
  render: () => (
    <StoryFrame width={720}>
      <Stats08 />
    </StoryFrame>
  ),
};

export const BlockStats09: Story = {
  name: "stats-09",
  render: () => (
    <StoryFrame width={720}>
      <Stats09 />
    </StoryFrame>
  ),
};

export const BlockStats10: Story = {
  name: "stats-10",
  render: () => (
    <StoryFrame width={720}>
      <Stats10 />
    </StoryFrame>
  ),
};

export const BlockStats11: Story = {
  name: "stats-11",
  render: () => (
    <StoryFrame width={720}>
      <Stats11 />
    </StoryFrame>
  ),
};

export const BlockStats12: Story = {
  name: "stats-12",
  render: () => (
    <StoryFrame width={720}>
      <Stats12 />
    </StoryFrame>
  ),
};

export const BlockStats13: Story = {
  name: "stats-13",
  render: () => (
    <StoryFrame width={720}>
      <Stats13 />
    </StoryFrame>
  ),
};

export const BlockStats14: Story = {
  name: "stats-14",
  render: () => (
    <StoryFrame width={720}>
      <Stats14 />
    </StoryFrame>
  ),
};

export const BlockStats15: Story = {
  name: "stats-15",
  render: () => (
    <StoryFrame width={720}>
      <Stats15 />
    </StoryFrame>
  ),
};

export const KiboCodebase: Story = {
  name: "codebase",
  render: () => (
    <StoryFrame width={720}>
      <Example_Codebase />
    </StoryFrame>
  ),
};

export const KiboCollaborativeCanvas: Story = {
  name: "collaborative canvas",
  render: () => (
    <StoryFrame width={720}>
      <Example_CollaborativeCanvas />
    </StoryFrame>
  ),
};

export const KiboGanttLanes: Story = {
  name: "gantt lanes",
  render: () => (
    <StoryFrame width={720}>
      <Example_GanttLanes />
    </StoryFrame>
  ),
};

export const KiboGanttNoSidebar: Story = {
  name: "gantt no sidebar",
  render: () => (
    <StoryFrame width={720}>
      <Example_GanttNoSidebar />
    </StoryFrame>
  ),
};

export const KiboGanttReadOnly: Story = {
  name: "gantt read only",
  render: () => (
    <StoryFrame width={720}>
      <Example_GanttReadOnly />
    </StoryFrame>
  ),
};

export const KiboGantt: Story = {
  name: "gantt",
  render: () => (
    <StoryFrame width={720}>
      <Example_Gantt />
    </StoryFrame>
  ),
};

export const KiboKanbanSimple: Story = {
  name: "kanban simple",
  render: () => (
    <StoryFrame width={720}>
      <Example_KanbanSimple />
    </StoryFrame>
  ),
};

export const KiboKanban: Story = {
  name: "kanban",
  render: () => (
    <StoryFrame width={720}>
      <Example_Kanban />
    </StoryFrame>
  ),
};

export const KiboListSimple: Story = {
  name: "list simple",
  render: () => (
    <StoryFrame width={720}>
      <Example_ListSimple />
    </StoryFrame>
  ),
};

export const KiboList: Story = {
  name: "list",
  render: () => (
    <StoryFrame width={720}>
      <Example_List />
    </StoryFrame>
  ),
};

export const KiboRoadmap: Story = {
  name: "roadmap",
  render: () => (
    <StoryFrame width={720}>
      <Example_Roadmap />
    </StoryFrame>
  ),
};

export const KiboSandboxNoFileExplorer: Story = {
  name: "sandbox no file explorer",
  render: () => (
    <StoryFrame width={720}>
      <Example_SandboxNoFileExplorer />
    </StoryFrame>
  ),
};

export const KiboSandbox: Story = {
  name: "sandbox",
  render: () => (
    <StoryFrame width={720}>
      <Example_Sandbox />
    </StoryFrame>
  ),
};
