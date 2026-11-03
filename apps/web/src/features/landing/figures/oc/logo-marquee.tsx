import { LANDING_LOGOS } from "../../landing-copy.ts"
import { useOnScreen } from "../use-on-screen.ts"
import { VENDORED_SIMPLE_ICONS_CC0_PATHS } from "./logo-marks.ts"
import "./logo-marquee.css"

const CROPPED_WORDMARK = "Coinbase"

function Mark({ name }: { name: (typeof LANDING_LOGOS)[number] }) {
  if (name === CROPPED_WORDMARK) {
    return (
      <svg
        width={100}
        height={22}
        viewBox="0 9.4 24 5.3"
        fill="currentColor"
        role="img"
        aria-label={name}
      >
        <path d={VENDORED_SIMPLE_ICONS_CC0_PATHS[name]} />
      </svg>
    )
  }
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={VENDORED_SIMPLE_ICONS_CC0_PATHS[name]} />
    </svg>
  )
}

const ROW_FILL_COPIES = [0, 1, 2, 3]

export function LogoMarquee() {
  const [ref, onScreen] = useOnScreen<HTMLDivElement>()
  return (
    <div ref={ref} className="lm-root" data-paused={onScreen ? undefined : ""}>
      <ul className="lm-track">
        {ROW_FILL_COPIES.map((copy) =>
          LANDING_LOGOS.map((name) => (
            <li
              key={`${copy}-${name}`}
              aria-hidden={copy > 0 ? true : undefined}
              className="lm-item"
            >
              <Mark name={name} />
              {name !== CROPPED_WORDMARK && <span>{name}</span>}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
