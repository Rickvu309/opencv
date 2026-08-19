"use client";

import { Pill, PillButton } from "../pill";
import { XIcon } from "lucide-react";

const Example = () => (
  <Pill>
    #kibo-ui
    <PillButton size="icon" variant="ghost">
      <XIcon size={12} />
    </PillButton>
  </Pill>
);

export default Example;
