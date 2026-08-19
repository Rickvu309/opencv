import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

addons.setConfig({
  theme: create({
    base: "light",
    brandTitle: "Opath (Lab)",
    brandUrl: "http://localhost:6007",
    brandTarget: "_self",
  }),
});
