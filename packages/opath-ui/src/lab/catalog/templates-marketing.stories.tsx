import type { Meta, StoryObj } from "@storybook/react-vite";
import { lazy } from "react";
import { LazyFrame } from "./lazy-frame";
const Example_About = lazy(() => import("../kibo/_examples/about").then((m) => ({ default: m.default ?? m.Example_About ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Awards = lazy(() => import("../kibo/_examples/awards").then((m) => ({ default: m.default ?? m.Example_Awards ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Blog = lazy(() => import("../kibo/_examples/blog").then((m) => ({ default: m.default ?? m.Example_Blog ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Blogpost = lazy(() => import("../kibo/_examples/blogpost").then((m) => ({ default: m.default ?? m.Example_Blogpost ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Careers = lazy(() => import("../kibo/_examples/careers").then((m) => ({ default: m.default ?? m.Example_Careers ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CaseStudies = lazy(() => import("../kibo/_examples/case-studies").then((m) => ({ default: m.default ?? m.Example_CaseStudies ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CaseStudy = lazy(() => import("../kibo/_examples/case-study").then((m) => ({ default: m.default ?? m.Example_CaseStudy ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Changelog = lazy(() => import("../kibo/_examples/changelog").then((m) => ({ default: m.default ?? m.Example_Changelog ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Community = lazy(() => import("../kibo/_examples/community").then((m) => ({ default: m.default ?? m.Example_Community ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Compliance = lazy(() => import("../kibo/_examples/compliance").then((m) => ({ default: m.default ?? m.Example_Compliance ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Contact = lazy(() => import("../kibo/_examples/contact").then((m) => ({ default: m.default ?? m.Example_Contact ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Cta = lazy(() => import("../kibo/_examples/cta").then((m) => ({ default: m.default ?? m.Example_Cta ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Download = lazy(() => import("../kibo/_examples/download").then((m) => ({ default: m.default ?? m.Example_Download ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Experience = lazy(() => import("../kibo/_examples/experience").then((m) => ({ default: m.default ?? m.Example_Experience ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Faq = lazy(() => import("../kibo/_examples/faq").then((m) => ({ default: m.default ?? m.Example_Faq ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_FeatureTabs = lazy(() => import("../kibo/_examples/feature-tabs").then((m) => ({ default: m.default ?? m.Example_FeatureTabs ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Feature = lazy(() => import("../kibo/_examples/feature").then((m) => ({ default: m.default ?? m.Example_Feature ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Footer = lazy(() => import("../kibo/_examples/footer").then((m) => ({ default: m.default ?? m.Example_Footer ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Hero = lazy(() => import("../kibo/_examples/hero").then((m) => ({ default: m.default ?? m.Example_Hero ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Pricing = lazy(() => import("../kibo/_examples/pricing").then((m) => ({ default: m.default ?? m.Example_Pricing ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Stats = lazy(() => import("../kibo/_examples/stats").then((m) => ({ default: m.default ?? m.Example_Stats ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Team = lazy(() => import("../kibo/_examples/team").then((m) => ({ default: m.default ?? m.Example_Team ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Testimonial = lazy(() => import("../kibo/_examples/testimonial").then((m) => ({ default: m.default ?? m.Example_Testimonial ?? Object.values(m).find((v) => typeof v === "function") })));

const meta = { title: "Lab/Templates/Marketing" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const KiboAbout: Story = {
  name: "about",
  render: () => (
    <LazyFrame width={720}>
      <Example_About />
    </LazyFrame>
  ),
};

export const KiboAwards: Story = {
  name: "awards",
  render: () => (
    <LazyFrame width={720}>
      <Example_Awards />
    </LazyFrame>
  ),
};

export const KiboBlog: Story = {
  name: "blog",
  render: () => (
    <LazyFrame width={720}>
      <Example_Blog />
    </LazyFrame>
  ),
};

export const KiboBlogpost: Story = {
  name: "blogpost",
  render: () => (
    <LazyFrame width={720}>
      <Example_Blogpost />
    </LazyFrame>
  ),
};

export const KiboCareers: Story = {
  name: "careers",
  render: () => (
    <LazyFrame width={720}>
      <Example_Careers />
    </LazyFrame>
  ),
};

export const KiboCaseStudies: Story = {
  name: "case studies",
  render: () => (
    <LazyFrame width={720}>
      <Example_CaseStudies />
    </LazyFrame>
  ),
};

export const KiboCaseStudy: Story = {
  name: "case study",
  render: () => (
    <LazyFrame width={720}>
      <Example_CaseStudy />
    </LazyFrame>
  ),
};

export const KiboChangelog: Story = {
  name: "changelog",
  render: () => (
    <LazyFrame width={720}>
      <Example_Changelog />
    </LazyFrame>
  ),
};

export const KiboCommunity: Story = {
  name: "community",
  render: () => (
    <LazyFrame width={720}>
      <Example_Community />
    </LazyFrame>
  ),
};

export const KiboCompliance: Story = {
  name: "compliance",
  render: () => (
    <LazyFrame width={720}>
      <Example_Compliance />
    </LazyFrame>
  ),
};

export const KiboContact: Story = {
  name: "contact",
  render: () => (
    <LazyFrame width={720}>
      <Example_Contact />
    </LazyFrame>
  ),
};

export const KiboCta: Story = {
  name: "cta",
  render: () => (
    <LazyFrame width={720}>
      <Example_Cta />
    </LazyFrame>
  ),
};

export const KiboDownload: Story = {
  name: "download",
  render: () => (
    <LazyFrame width={720}>
      <Example_Download />
    </LazyFrame>
  ),
};

export const KiboExperience: Story = {
  name: "experience",
  render: () => (
    <LazyFrame width={720}>
      <Example_Experience />
    </LazyFrame>
  ),
};

export const KiboFaq: Story = {
  name: "faq",
  render: () => (
    <LazyFrame width={720}>
      <Example_Faq />
    </LazyFrame>
  ),
};

export const KiboFeatureTabs: Story = {
  name: "feature tabs",
  render: () => (
    <LazyFrame width={720}>
      <Example_FeatureTabs />
    </LazyFrame>
  ),
};

export const KiboFeature: Story = {
  name: "feature",
  render: () => (
    <LazyFrame width={720}>
      <Example_Feature />
    </LazyFrame>
  ),
};

export const KiboFooter: Story = {
  name: "footer",
  render: () => (
    <LazyFrame width={720}>
      <Example_Footer />
    </LazyFrame>
  ),
};

export const KiboHero: Story = {
  name: "hero",
  render: () => (
    <LazyFrame width={720}>
      <Example_Hero />
    </LazyFrame>
  ),
};

export const KiboPricing: Story = {
  name: "pricing",
  render: () => (
    <LazyFrame width={720}>
      <Example_Pricing />
    </LazyFrame>
  ),
};

export const KiboStats: Story = {
  name: "stats",
  render: () => (
    <LazyFrame width={720}>
      <Example_Stats />
    </LazyFrame>
  ),
};

export const KiboTeam: Story = {
  name: "team",
  render: () => (
    <LazyFrame width={720}>
      <Example_Team />
    </LazyFrame>
  ),
};

export const KiboTestimonial: Story = {
  name: "testimonial",
  render: () => (
    <LazyFrame width={720}>
      <Example_Testimonial />
    </LazyFrame>
  ),
};
