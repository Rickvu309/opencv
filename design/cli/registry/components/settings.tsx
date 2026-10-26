import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import { cn } from "./cn"
import { IconTile, LogoTile } from "./display"
import { NavItem, type LinkLike, type NavEntry } from "./shell"

/** Settings nav (244) and a 640 column on the canvas color. */
export function SettingsLayout({
  nav,
  activeHref,
  backHref = "/",
  link,
  children,
}: {
  nav: NavEntry[]
  activeHref: string
  backHref?: string
  link?: LinkLike
  children: ReactNode
}) {
  const L =
    link ?? ((({ href, ...rest }) => <a href={href} {...rest} />) as LinkLike)
  return (
    <div className="flex h-dvh min-h-[560px] flex-col bg-sidebar md:flex-row">
      <nav
        className="flex shrink-0 gap-1 overflow-x-auto px-2 py-2 md:hidden"
        aria-label="Settings"
      >
        {nav.map((it) => (
          <NavItem
            key={it.href}
            item={it}
            active={activeHref === it.href}
            link={link}
          />
        ))}
      </nav>
      <aside
        className="hidden w-[244px] shrink-0 flex-col gap-px px-2.5 pt-2.5 md:flex"
        aria-label="Settings"
      >
        <L
          href={backHref}
          className="rounded-row text-fg-2 hover:bg-hover mb-3 flex h-7 items-center gap-2 px-2 font-medium"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to app
        </L>
        <div className="text-small text-fg-3 flex h-6 items-center px-2">
          Settings
        </div>
        {nav.map((it) => (
          <NavItem
            key={it.href}
            item={it}
            active={activeHref === it.href}
            link={link}
          />
        ))}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 px-2 pb-2 md:pt-2 md:pl-0">
        <main className="rounded-tile bg-canvas flex flex-1 justify-center overflow-y-auto px-4 pt-8 pb-10 shadow-[0_0_0_0.5px_var(--color-border)] md:px-10 md:pt-14">
          <div className="flex w-[640px] max-w-full flex-col">{children}</div>
        </main>
      </div>
    </div>
  )
}

export function SettingsTitle({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div className="mb-7 flex flex-col gap-1.5">
      <h1 className="text-page font-semibold tracking-[-0.5px]">{title}</h1>
      {children && <p className="text-fg-2">{children}</p>}
    </div>
  )
}

/** Label, optional note on the right, then a white card of rows. */
export function SettingsSection({
  label,
  note,
  children,
  className,
}: {
  label: string
  note?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("mb-7 flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-body text-fg-2 font-medium">{label}</h2>
        {note && <span className="text-fg-3">{note}</span>}
      </div>
      {children}
    </section>
  )
}

export function SettingsCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-card bg-surface flex flex-col divide-y-[0.5px] divide-border overflow-hidden ring-[0.5px] ring-border",
        className
      )}
    >
      {children}
    </div>
  )
}

/** The building block of every settings page: tile, label, one line, control on the right. */
export function SettingsRow({
  icon,
  label,
  desc,
  control,
  onClick,
}: {
  icon?: ReactNode
  label: string
  desc?: string
  control?: ReactNode
  onClick?: () => void
}) {
  const Comp = onClick ? "button" : "div"
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-5 py-3.5 text-left",
        onClick && "hover:bg-subtle"
      )}
    >
      {icon && <IconTile>{icon}</IconTile>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium">{label}</span>
        {desc && <span className="text-fg-3 text-[12.5px]">{desc}</span>}
      </span>
      {control}
    </Comp>
  )
}

/** One app, one line. Enabled shows a green dot, expired a grey one. */
export function IntegrationCard({
  logo,
  name,
  line,
  state = "available",
  onClick,
}: {
  logo: string
  name: string
  line: string
  state?: "available" | "enabled" | "expired"
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-card bg-surface hover:bg-subtle hover:ring-border-strong flex w-full items-center gap-3 p-3.5 text-left ring-[0.5px] ring-border hover:ring-1"
    >
      <LogoTile src={logo} alt="" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">{name}</span>
        <span className="text-small text-fg-2 flex items-center gap-[5px]">
          {state !== "available" && (
            <span
              className={cn(
                "size-1.5 rounded-full",
                state === "enabled" ? "bg-success" : "bg-fg-3"
              )}
            />
          )}
          {state === "enabled"
            ? "Enabled"
            : state === "expired"
              ? "Access expired"
              : line}
        </span>
      </span>
    </button>
  )
}
