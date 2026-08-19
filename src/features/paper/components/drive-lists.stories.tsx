import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@/ui/button";
import { Band, BandFilter } from "@/ui/band";
import { GroupHeader, Row, RowList } from "@/ui/rows";
import { EmptyState } from "@/ui/empty-state";
import { EndOfList } from "@/ui/card";
import { Chip } from "@/ui/chip";

const meta: Meta = {
  title: "Drive/Lists",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const PaperEmpty: Story = {
  render: () => (
    <div>
      <Band title="Paper" primary={<Button>Start a CV</Button>} />
      <EmptyState kind="first-run" title="Start with the CV." />
    </div>
  ),
};

export const PaperRows: Story = {
  render: () => (
    <div>
      <Band
        title="Paper"
        primary={<Button>Start a CV</Button>}
        filter={
          <BandFilter
            value="all"
            onChange={() => undefined}
            options={[
              { id: "all", label: "All" },
              { id: "cv", label: "CV / Resume" },
              { id: "letter", label: "Letter" },
              { id: "uploaded", label: "Uploaded" },
            ]}
          />
        }
      />
      <RowList bleed>
        <Row label="Analyst CV" meta="CV · 2 days ago" onSelect={() => undefined} />
        <Row label="Cover letter" meta="Letter · Yesterday" onSelect={() => undefined} />
      </RowList>
      <EndOfList />
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
