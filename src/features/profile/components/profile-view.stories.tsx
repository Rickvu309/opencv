import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  emptyProfileDraft,
  ProfileView,
  type ProfileDraft,
  type ProfileViewData,
} from "./profile-view";

const meta: Meta<typeof ProfileView> = {
  title: "Profile/Screen",
  component: ProfileView,
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof ProfileView>;

const filled: ProfileViewData = {
  completeness: 42,
  name: "Nguyễn Thị Ngọc Ánh",
  targetRole: "Analyst",
  location: "Hanoi",
  timeAvailable: "Evenings",
  education: {
    school: "NEU",
    major: "Finance",
    year: "2026",
    gpa: "",
    courses: ["Statistics"],
  },
  experience: [
    {
      id: "1",
      role: "Intern",
      org: "Grab",
      dateFrom: "Jun 2024",
      dateTo: "Aug 2024",
      detail: ["Ran weekend dispatch when two people called out"],
    },
  ],
  facts: [{ id: "f1", label: "Language", value: "English, conversational" }],
  links: [{ kind: "linkedin", url: "https://linkedin.com/in/anh" }],
};

const filledDraft: ProfileDraft = {
  ...emptyProfileDraft,
  name: filled.name,
  targetRole: filled.targetRole,
  location: filled.location,
  timeAvailable: filled.timeAvailable,
  school: filled.education.school,
  major: filled.education.major,
  year: filled.education.year,
  gpa: filled.education.gpa,
  courses: filled.education.courses.join("\n"),
  linkedin: "https://linkedin.com/in/anh",
};

const idle = {
  onDraft: () => undefined,
  onSaveIdentity: () => undefined,
  onSaveEducation: () => undefined,
  onSaveExperience: () => undefined,
  onSaveFact: () => undefined,
  onSaveLinks: () => undefined,
  onStartCv: () => undefined,
  confirm: null,
  onConfirmChange: () => undefined,
  onConfirmRemove: () => undefined,
};

export const Filled: Story = {
  args: { data: filled, draft: filledDraft, ...idle },
};

export const FirstRun: Story = {
  args: {
    data: {
      completeness: 0,
      name: "",
      targetRole: "",
      location: "",
      timeAvailable: "",
      education: { school: "", major: "", year: "", gpa: "", courses: [] },
      experience: [],
      facts: [],
      links: [],
    },
    empty: true,
    draft: emptyProfileDraft,
    ...idle,
  },
};

export const Thin: Story = {
  args: {
    data: {
      completeness: 0,
      name: "Nguyễn Thị Ngọc Ánh",
      targetRole: "Analyst",
      location: "",
      timeAvailable: "",
      education: { school: "", major: "", year: "", gpa: "", courses: [] },
      experience: [],
      facts: [],
      links: [],
    },
    draft: {
      ...emptyProfileDraft,
      name: "Nguyễn Thị Ngọc Ánh",
      targetRole: "Analyst",
    },
    ...idle,
  },
};

export const AddingExperience: Story = {
  args: {
    data: filled,
    draft: {
      ...filledDraft,
      addingExperience: true,
      expOrg: "",
      expRole: "",
    },
    ...idle,
  },
};

export const RemoveConfirm: Story = {
  args: {
    data: filled,
    draft: filledDraft,
    ...idle,
    confirm: { kind: "experience", id: "1", label: "Intern at Grab" },
  },
};

export const Loading: Story = {
  args: { pending: true, draft: emptyProfileDraft, ...idle },
};

export const Error: Story = {
  args: { error: true, onRetry: () => undefined, draft: emptyProfileDraft, ...idle },
};
