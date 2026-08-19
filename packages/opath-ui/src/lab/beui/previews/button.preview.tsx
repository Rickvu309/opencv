import { Button, MagneticButton, StatefulButton } from "../motion/button";

export function ButtonPreview() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Press</Button>
      <MagneticButton>Magnetic</MagneticButton>
      <StatefulButton>Save</StatefulButton>
    </div>
  );
}
