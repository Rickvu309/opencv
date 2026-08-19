"use client";

import { Pill, PillIndicator } from "../pill";

const Example = () => (
  <>
    <Pill>
      <PillIndicator pulse variant="success" />
      Active
    </Pill>
    <Pill>
      <PillIndicator variant="error" />
      Error
    </Pill>
  </>
);

export default Example;
