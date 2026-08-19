import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";
import Example_About from "../kibo/_examples/about";
import Example_Awards from "../kibo/_examples/awards";
import Example_Blog from "../kibo/_examples/blog";
import Example_Blogpost from "../kibo/_examples/blogpost";
import Example_Careers from "../kibo/_examples/careers";
import Example_CaseStudies from "../kibo/_examples/case-studies";
import Example_CaseStudy from "../kibo/_examples/case-study";
import Example_Changelog from "../kibo/_examples/changelog";
import Example_Community from "../kibo/_examples/community";
import Example_Compliance from "../kibo/_examples/compliance";
import Example_Contact from "../kibo/_examples/contact";
import Example_Cta from "../kibo/_examples/cta";
import Example_Download from "../kibo/_examples/download";
import Example_Experience from "../kibo/_examples/experience";
import Example_Faq from "../kibo/_examples/faq";
import Example_FeatureTabs from "../kibo/_examples/feature-tabs";
import Example_Feature from "../kibo/_examples/feature";
import Example_Footer from "../kibo/_examples/footer";
import Example_Hero from "../kibo/_examples/hero";
import Example_Pricing from "../kibo/_examples/pricing";
import Example_Stats from "../kibo/_examples/stats";
import Example_Team from "../kibo/_examples/team";
import Example_Testimonial from "../kibo/_examples/testimonial";

const meta = { title: "Lab/Templates/Marketing" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const KiboAbout: Story = {
  name: "about",
  render: () => (
    <StoryFrame width={720}>
      <Example_About />
    </StoryFrame>
  ),
};

export const KiboAwards: Story = {
  name: "awards",
  render: () => (
    <StoryFrame width={720}>
      <Example_Awards />
    </StoryFrame>
  ),
};

export const KiboBlog: Story = {
  name: "blog",
  render: () => (
    <StoryFrame width={720}>
      <Example_Blog />
    </StoryFrame>
  ),
};

export const KiboBlogpost: Story = {
  name: "blogpost",
  render: () => (
    <StoryFrame width={720}>
      <Example_Blogpost />
    </StoryFrame>
  ),
};

export const KiboCareers: Story = {
  name: "careers",
  render: () => (
    <StoryFrame width={720}>
      <Example_Careers />
    </StoryFrame>
  ),
};

export const KiboCaseStudies: Story = {
  name: "case studies",
  render: () => (
    <StoryFrame width={720}>
      <Example_CaseStudies />
    </StoryFrame>
  ),
};

export const KiboCaseStudy: Story = {
  name: "case study",
  render: () => (
    <StoryFrame width={720}>
      <Example_CaseStudy />
    </StoryFrame>
  ),
};

export const KiboChangelog: Story = {
  name: "changelog",
  render: () => (
    <StoryFrame width={720}>
      <Example_Changelog />
    </StoryFrame>
  ),
};

export const KiboCommunity: Story = {
  name: "community",
  render: () => (
    <StoryFrame width={720}>
      <Example_Community />
    </StoryFrame>
  ),
};

export const KiboCompliance: Story = {
  name: "compliance",
  render: () => (
    <StoryFrame width={720}>
      <Example_Compliance />
    </StoryFrame>
  ),
};

export const KiboContact: Story = {
  name: "contact",
  render: () => (
    <StoryFrame width={720}>
      <Example_Contact />
    </StoryFrame>
  ),
};

export const KiboCta: Story = {
  name: "cta",
  render: () => (
    <StoryFrame width={720}>
      <Example_Cta />
    </StoryFrame>
  ),
};

export const KiboDownload: Story = {
  name: "download",
  render: () => (
    <StoryFrame width={720}>
      <Example_Download />
    </StoryFrame>
  ),
};

export const KiboExperience: Story = {
  name: "experience",
  render: () => (
    <StoryFrame width={720}>
      <Example_Experience />
    </StoryFrame>
  ),
};

export const KiboFaq: Story = {
  name: "faq",
  render: () => (
    <StoryFrame width={720}>
      <Example_Faq />
    </StoryFrame>
  ),
};

export const KiboFeatureTabs: Story = {
  name: "feature tabs",
  render: () => (
    <StoryFrame width={720}>
      <Example_FeatureTabs />
    </StoryFrame>
  ),
};

export const KiboFeature: Story = {
  name: "feature",
  render: () => (
    <StoryFrame width={720}>
      <Example_Feature />
    </StoryFrame>
  ),
};

export const KiboFooter: Story = {
  name: "footer",
  render: () => (
    <StoryFrame width={720}>
      <Example_Footer />
    </StoryFrame>
  ),
};

export const KiboHero: Story = {
  name: "hero",
  render: () => (
    <StoryFrame width={720}>
      <Example_Hero />
    </StoryFrame>
  ),
};

export const KiboPricing: Story = {
  name: "pricing",
  render: () => (
    <StoryFrame width={720}>
      <Example_Pricing />
    </StoryFrame>
  ),
};

export const KiboStats: Story = {
  name: "stats",
  render: () => (
    <StoryFrame width={720}>
      <Example_Stats />
    </StoryFrame>
  ),
};

export const KiboTeam: Story = {
  name: "team",
  render: () => (
    <StoryFrame width={720}>
      <Example_Team />
    </StoryFrame>
  ),
};

export const KiboTestimonial: Story = {
  name: "testimonial",
  render: () => (
    <StoryFrame width={720}>
      <Example_Testimonial />
    </StoryFrame>
  ),
};
