import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@/ui/button";
import { Band } from "@/ui/band";
import { PageCanvas } from "@/ui/page-canvas";
import { GroupHeader, Row, RowList } from "@/ui/rows";
import { EmptyState } from "@/ui/empty-state";
import { EndOfList } from "@/ui/card";
import { Chip } from "@/ui/chip";
import { ProofLines } from "@/features/paper/components/page";

const meta: Meta = {
  title: "Screens/Paper",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const PaperEmpty: Story = {
  tags: ["autodocs"],
  render: () => (
    <div>
      <Band title="Paper" />
      <div className="-mx-5">
        <PageCanvas empty label="Open a CV" onOpen={() => undefined} />
      </div>
    </div>
  ),
};

export const PaperWithProof: Story = {
  tags: ["autodocs"],
  render: () => (
    <div>
      <Band title="Paper" />
      <div className="-mx-5">
        <PageCanvas label="Open this CV" onOpen={() => undefined}>
          <ProofLines
            lines={[
              {
                date: "2026-08-20",
                words:
                  "Saturday close. We ran out of oat milk and I stayed until the last table left.",
              },
            ]}
          />
        </PageCanvas>
      </div>
    </div>
  ),
};

export const ProofEmpty: Story = {
  render: () => (
    <div>
      <Band title="Proof" primary={<Button>Log something</Button>} />
      <EmptyState
        kind="first-run"
        title="Log what you're making."
        basis="A class project, a shift, an assignment, something that failed — it all counts."
      />
    </div>
  ),
};

export const SearchEmpty: Story = {
  render: () => (
    <div>
      <Band title="Search" />
      <EmptyState
        kind="first-run"
        title="Paste a posting you're looking at, and you'll see how you match."
      />
    </div>
  ),
};

export const SearchRows: Story = {
  render: () => (
    <div>
      <Band title="Search" />
      <RowList bleed>
        <Row
          label="Business analyst intern"
          chip={<Chip tone="quiet">Fit 4 of 6 — misses SQL</Chip>}
          meta="Vietcombank · Hà Nội"
          onSelect={() => undefined}
        />
        <Row
          label="Operations intern"
          chip={<Chip tone="quiet">Fit 5 of 6</Chip>}
          meta="Grab · TP.HCM"
          onSelect={() => undefined}
        />
      </RowList>
      <EndOfList />
    </div>
  ),
};

export const ApplyEmpty: Story = {
  render: () => (
    <div>
      <Band title="Apply" />
      <EmptyState
        kind="first-run"
        title="Nothing in motion yet. Save an opening from Search and work it here."
        action={<Button>Go to Search</Button>}
      />
    </div>
  ),
};

export const ApplyRows: Story = {
  render: () => (
    <div>
      <Band title="Apply" />
      <section className="mt-4">
        <GroupHeader label="Interested" count={1} status="attention" />
        <RowList bleed>
          <Row
            label="Business analyst intern"
            chip={<Chip tone="status" status="attention">Interested</Chip>}
            meta="Vietcombank · Tailor the CV and send it."
          />
        </RowList>
      </section>
      <EndOfList />
    </div>
  ),
};

export const ProofRows: Story = {
  render: () => (
    <div>
      <Band title="Proof" primary={<Button>Log something</Button>} />
      <RowList bleed>
        <Row
          label="Weekend batch"
          chip={<Chip tone="status" status="positive">published</Chip>}
          meta="Intern · 2025–2026"
          onSelect={() => undefined}
        />
      </RowList>
      <EndOfList />
    </div>
  ),
};
