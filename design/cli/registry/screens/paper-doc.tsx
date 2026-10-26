import { useState } from "react"
import {
  ChevronRight,
  FileText,
  Star,
  Ellipsis,
  Link2,
  Bell,
  SlidersHorizontal,
  MessageCircle,
} from "lucide-react"
import { IconButton } from "~components/button"
import {
  CvBullet,
  CvContact,
  CvEntry,
  CvName,
  CvSection,
  PaperPage,
} from "~components/paper"
import { AppFrame, RouterLink } from "~app/app-frame"

/** Paper editor: breadcrumb top bar, the page on the desk, selection asks Coach. */
export default function PaperDoc() {
  const [sel, setSel] = useState<number | null>(1)
  const bullets = [
    "Ran 12 social campaigns and grew followers by 38% in four months.",
    "Wrote weekly TikTok scripts; three passed 100k views.",
  ]
  return (
    <AppFrame dock={["Tailor this CV for Lumière"]}>
      <header className="flex h-[52px] shrink-0 items-center gap-1.5 border-b-[0.5px] border-border pr-3 pl-5">
        <nav
          aria-label="Breadcrumb"
          className="text-body flex items-center gap-1.5"
        >
          <RouterLink href="/paper" className="text-fg-2 hover:text-fg">
            Paper
          </RouterLink>
          <ChevronRight className="text-fg-3 size-3.5" />
          <span className="text-fg-2">CVs</span>
          <ChevronRight className="text-fg-3 size-3.5" />
          <span className="inline-flex items-center gap-1.5 font-medium">
            <FileText className="size-3.5" />
            Junior Marketing CV
          </span>
        </nav>
        <IconButton label="Favorite" size={24}>
          <Star />
        </IconButton>
        <IconButton label="More" size={24}>
          <Ellipsis />
        </IconButton>
        <span className="flex-1" />
        <span className="text-small text-fg-3 mr-2 inline-flex items-center gap-1.5">
          <SlidersHorizontal className="size-3" />
          Edited just now
        </span>
        <IconButton label="Copy link">
          <Link2 />
        </IconButton>
        <IconButton label="Notifications">
          <Bell />
        </IconButton>
      </header>
      <div className="flex flex-1 justify-center overflow-y-auto bg-[#F4F4F6] py-8">
        <div className="relative">
          {sel !== null && (
            <div className="rounded-tile bg-surface shadow-pop absolute -top-1 left-12 z-10 flex h-8 items-center gap-1 px-1 ring-[0.5px] ring-border">
              <button className="rounded-row text-small hover:bg-subtle inline-flex h-6 items-center gap-1.5 px-2 font-medium">
                <MessageCircle className="size-3.5" />
                Coach
              </button>
              <span className="h-4 w-px bg-border" />
              {["B", "I", "U"].map((t) => (
                <button
                  key={t}
                  className="rounded-row text-small hover:bg-subtle inline-flex size-6 items-center justify-center font-semibold"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          <PaperPage>
            <CvName>Linh Nguyen</CvName>
            <CvContact
              items={[
                "linh.nguyen@gmail.com",
                "090 123 4567",
                "Ho Chi Minh City",
              ]}
            />
            <CvSection title="Experience">
              <CvEntry title="Marketing Intern, Lumière" when="Jun 2025 to now">
                {bullets.map((b, i) => (
                  <div key={b} onClick={() => setSel(i)}>
                    <CvBullet selected={sel === i}>{b}</CvBullet>
                  </div>
                ))}
              </CvEntry>
              <CvEntry title="Content Lead, Business Club" when="2024 to 2025">
                <CvBullet>
                  Wrote a weekly newsletter for 1,200 students with a 52% open
                  rate.
                </CvBullet>
                <CvBullet>
                  Led a team of four writers and two designers.
                </CvBullet>
              </CvEntry>
            </CvSection>
            <CvSection title="Education">
              <CvEntry
                title="University of Economics, BBA Marketing"
                when="2022 to 2026"
              >
                <CvBullet>GPA 3.6 / 4.0. Dean's list, 2024.</CvBullet>
              </CvEntry>
            </CvSection>
            <CvSection title="Skills">
              <p className="text-[12px] leading-normal">
                Canva, CapCut, Google Analytics, Meta Ads, Excel, English (IELTS
                7.5)
              </p>
            </CvSection>
          </PaperPage>
        </div>
      </div>
    </AppFrame>
  )
}
