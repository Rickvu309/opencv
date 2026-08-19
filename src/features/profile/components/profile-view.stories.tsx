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
  name: "Nguyễn Thị Ngọc Ánh",
  targetRole: "Analyst",
  education: {
    school: "NEU",
    major: "Finance",
    year: "2026",
  },
  experience: [
    {
      id: "1",
      role: "Intern",
      org: "Grab",
      dateFrom: "Jun 2024",
      dateTo: "Aug 2024",
    },
  ],
  links: [{ kind: "linkedin", url: "https://linkedin.com/in/anh" }],
};

const filledDraft: ProfileDraft = {
  ...emptyProfileDraft,
  name: filled.name,
  targetRole: filled.targetRole,
  school: filled.education.school,
  major: filled.education.major,
  year: filled.education.year,
  linkedin: "https://linkedin.com/in/anh",
};

const idle = {
  onDraft: () => undefined,
  onIdentityBlur: () => undefined,
  onEducationBlur: () => undefined,
  onExperienceBlur: () => undefined,
  onLinkBlur: () => undefined,
  onAddSchool: () => undefined,
  onAddExperience: () => undefined,
  confirm: null,
  onConfirmChange: () => undefined,
  onConfirmRemove: () => undefined,
};

const emptyData: ProfileViewData = {
  name: "",
  targetRole: "",
  education: { school: "", major: "", year: "" },
  experience: [],
  links: [],
};

export const Empty: Story = {
  args: {
    data: emptyData,
    draft: emptyProfileDraft,
    ...idle,
  },
};

export const Filled: Story = {
  args: { data: filled, draft: filledDraft, ...idle },
};

export const AddingSchool: Story = {
  name: "Adding school",
  args: {
    data: emptyData,
    draft: { ...emptyProfileDraft, addingSchool: true },
    ...idle,
  },
};

export const AddingExperience: Story = {
  name: "Adding experience",
  args: {
    data: {
      ...emptyData,
      experience: [{ id: "new", org: "", role: "", dateFrom: "", dateTo: "" }],
    },
    draft: {
      ...emptyProfileDraft,
      editingExperienceId: "new",
      expOrg: "",
      expRole: "",
    },
    ...idle,
  },
};
