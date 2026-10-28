import { LANDING_LOGOS } from "../../landing-copy.ts"
import { useOnScreen } from "../use-on-screen.ts"
import { LOGO_MARKS } from "./logo-marks.ts"
import "./logo-marquee.css"

/** Coinbase ships as a wordmark centred in a square; crop the viewBox to the word. */
const WORDMARK = "Coinbase"

function Mark({ name }: { name: (typeof LANDING_LOGOS)[number] }) {
  if (name === WORDMARK) {
    return (
      <svg
        width={100}
        height={22}
        viewBox="0 9.4 24 5.3"
        fill="currentColor"
        role="img"
        aria-label={name}
      >
        <path d={LOGO_MARKS[name]} />
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
      <path d={LOGO_MARKS[name]} />
    </svg>
  )
}

/** Brand marks with their names scrolling in an endless loop with faded edges; paused while off screen. */
export function LogoMarquee() {
  const [ref, onScreen] = useOnScreen<HTMLDivElement>()
  return (
    <div ref={ref} className="lm-root" data-paused={onScreen ? undefined : ""}>
      <ul className="lm-track">
        {[0, 1].map((copy) =>
          LANDING_LOGOS.map((name) => (
            <li
              key={`${copy}-${name}`}
              aria-hidden={copy === 1 ? true : undefined}
              className="lm-item"
            >
              <Mark name={name} />
              {name !== WORDMARK && <span>{name}</span>}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
