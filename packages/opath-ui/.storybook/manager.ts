import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

addons.setConfig({
  theme: create({
    base: "light",
    brandTitle: "Opath (Lab)",
    brandUrl: "https://opath-lab.up.railway.app",
    brandTarget: "_self",
  }),
});
