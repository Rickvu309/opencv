import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@/ui/button";
import { Band } from "@/ui/band";
import { emptyCv, emptyLetter, paperContentSchema } from "@/features/paper/model";
import { NewCvCard, PaperDriveCard, PaperDriveGrid } from "@/features/paper/components/thumb";

const meta: Meta = {
  title: "Screens/Paper",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

const cvPreview = paperContentSchema.parse({
  ...emptyCv(),
  name: "Nguyễn Thị Ngọc Ánh",
  contact: "Da Nang · anh@example.com",
  experience: [
    {
      id: "e1",
      org: "Cafe",
      role: "Barista",
      dates: "2024 – 2026",
      bullets: ["Kept the till within 2,000 dong each weekend shift."],
    },
  ],
  education: [{ id: "ed1", school: "DUT", line: "Business, 2026" }],
  skills: ["SQL"],
});

const letterPreview = paperContentSchema.parse({
  ...emptyLetter("posted"),
  paragraphs: [
    "I'm writing about the analyst intern role at Vietcombank.",
    "I ran weekend shifts at a cafe and kept the till within 2,000 dong.",
    "I can start in June, and this is how to reach me.",
  ],
});

function CardMenuStub({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex size-11 items-center justify-center rounded-[var(--radius-control)] text-[13px]"
      aria-label={`Actions for ${label}`}
    >
      ···
    </button>
  );
}

export const PaperEmpty: Story = {
  render: () => (
    <div>
      <Band title="Paper" primary={<Button>New CV</Button>} secondary={<Button variant="ghost">Upload</Button>} />
      <PaperDriveGrid>
        <NewCvCard onSelect={() => undefined} />
      </PaperDriveGrid>
    </div>
  ),
};

export const PaperGrid: Story = {
  render: () => (
    <div>
      <Band title="Paper" primary={<Button>New CV</Button>} secondary={<Button variant="ghost">Upload</Button>} />
      <PaperDriveGrid>
        <NewCvCard onSelect={() => undefined} />
        <PaperDriveCard
          kind="cv"
          content={cvPreview}
          title="Analyst CV"
          updated="2 days ago"
          onSelect={() => undefined}
          menu={<CardMenuStub label="Analyst CV" />}
        />
        <PaperDriveCard
          kind="letter"
          content={letterPreview}
          title="Cover letter"
          updated="Yesterday"
          onSelect={() => undefined}
          menu={<CardMenuStub label="Cover letter" />}
        />
      </PaperDriveGrid>
    </div>
  ),
};
