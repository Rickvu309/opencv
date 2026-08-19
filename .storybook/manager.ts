import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

addons.setConfig({
  theme: create({
    base: "light",
    brandTitle: "Opath (Production)",
    brandUrl: "https://opath-production.vercel.app",
    brandTarget: "_self",
  }),
});
