import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta: Meta<typeof Tabs> = {
  title: "Components/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "In-page toggle group. Active is surface-3 plus accent text. Never accent fill. No animation.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="one" className="w-[20rem]">
      <TabsList>
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two">Two</TabsTrigger>
        <TabsTrigger value="three">Three</TabsTrigger>
      </TabsList>
      <TabsContent value="one" className="pt-3 text-[15px]">
        First panel
      </TabsContent>
      <TabsContent value="two" className="pt-3 text-[15px]">
        Second panel
      </TabsContent>
      <TabsContent value="three" className="pt-3 text-[15px]">
        Third panel
      </TabsContent>
    </Tabs>
  ),
};
