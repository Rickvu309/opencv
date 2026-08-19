import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";

const meta: Meta = {
  title: "Components/Tabs",
};
export default meta;

type Story = StoryObj;

export const Rest: Story = {
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
