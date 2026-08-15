"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PaperToolbar } from "@/components/paper/toolbar";
import { Button } from "@/components/ui/button";
import { useAppState, useDispatch } from "@/lib/actions/store";
import { themeForTemplate, wordForTemplate } from "@/lib/paper/cv";
import { paperHref, roomMode, sheetTransitionName, shouldTravel } from "@/lib/paper/room";
import {
  isCvPaper,
  isLetterPaper,
  type CvTemplate,
  type LetterSituation,
} from "@/lib/paper/types";
import { useT } from "@/lib/i18n/use-t";
import { CvGallery, LetterChooser } from "./choosers";
import { Drive, DriveBand, type DriveFilter } from "./drive";
import { Opened, OpenedBand } from "./opened";

export default function PaperPage() {
  return (
    <Suspense fallback={null}>
      <MyPaperWorkspace />
    </Suspense>
  );
}

function go(
  router: ReturnType<typeof useRouter>,
  href: string,
  kind: "open" | "back" | "land",
) {
  const run = () => router.replace(href, { scroll: false });
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (
    !shouldTravel(kind) ||
    reduce ||
    typeof document.startViewTransition !== "function"
  ) {
    run();
    return;
  }
  document.startViewTransition(run);
}

function MyPaperWorkspace() {
  const { paper, profile } = useAppState();
  const dispatch = useDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, m } = useT();
  const [filter, setFilter] = React.useState<DriveFilter>("all");

  const id = searchParams.get("id");
  const creatingParam = searchParams.get("new");
  const creating =
    creatingParam === "cv" || creatingParam === "letter" ? creatingParam : null;
  const format = searchParams.get("format") === "1";
  const arranging = searchParams.get("arrange") === "1";
  const fromUpload = searchParams.get("from") === "upload";
  const opened = id ? (paper.find((item) => item.id === id) ?? null) : null;
  const newest = paper.at(-1);
  const mode = roomMode({
    id,
    creating,
    format,
    openedType: opened?.type ?? null,
  });
  const galleryTravelName =
    opened && isCvPaper(opened)
      ? sheetTransitionName(opened.id)
      : creating === "cv" && newest
        ? sheetTransitionName(newest.id)
        : undefined;

  const pending = React.useRef(false);
  const pendingFromUpload = React.useRef(false);
  const pendingTravel = React.useRef(false);

  React.useEffect(() => {
    if (!pending.current) return;
    const newest = paper.at(-1);
    if (!newest) return;
    pending.current = false;
    const upload = pendingFromUpload.current;
    const travel = pendingTravel.current;
    pendingFromUpload.current = false;
    pendingTravel.current = false;
    go(
      router,
      paperHref({ id: newest.id, fromUpload: upload }),
      travel ? "open" : "land",
    );
  }, [paper, router]);

  React.useEffect(() => {
    if (id && !paper.some((item) => item.id === id)) {
      go(router, paperHref(), "land");
    }
  }, [id, paper, router]);

  const goDrive = () => go(router, paperHref(), "back");
  const onWillCreate = (opts?: { fromUpload?: boolean; travel?: boolean }) => {
    pending.current = true;
    pendingFromUpload.current = Boolean(opts?.fromUpload);
    pendingTravel.current = Boolean(opts?.travel);
  };

  const createCv = (template: CvTemplate, fromProfile: boolean) => {
    const role = profile.identity.targetRole.trim();
    const word = wordForTemplate(template);
    onWillCreate({ travel: true });
    dispatch(
      "paper.create",
      {
        type: "cv",
        label: role ? `${word}, ${role}` : t(m.paper.cv.untitled(1)),
        template,
        fromProfile,
        ...(role ? { targetRole: role } : {}),
      },
      { silent: true },
    );
  };

  const createLetter = (
    situation: LetterSituation,
    extras: { role?: string; org?: string } = {},
  ) => {
    const role = extras.role?.trim();
    const org = extras.org?.trim();
    onWillCreate();
    dispatch("paper.create", {
      type: "letter",
      label: [role, org].filter(Boolean).join(" · ") || t(m.paper.letter.untitled),
      situation,
      ...(role ? { targetRole: role } : {}),
      ...(org ? { org } : {}),
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PaperToolbar>
        {mode === "drive" ? (
          <DriveBand
            filter={filter}
            onFilter={setFilter}
            onRequestCreateCv={() =>
              go(router, paperHref({ creating: "cv" }), "land")
            }
            onRequestCreateLetter={() =>
              go(router, paperHref({ creating: "letter" }), "land")
            }
            onWillCreate={onWillCreate}
          />
        ) : null}
        {mode === "gallery" ? (
          <ChooserBand
            title={t(m.paper.galleryTitle)}
            onBack={() =>
              go(router, opened ? paperHref({ id: opened.id }) : paperHref(), "land")
            }
          />
        ) : null}
        {mode === "letter" ? (
          <ChooserBand
            title={t(m.paper.letterChooserTitle)}
            onBack={() =>
              go(router, opened ? paperHref({ id: opened.id }) : paperHref(), "land")
            }
          />
        ) : null}
        {mode === "docs" && opened ? (
          <OpenedBand
            paper={opened}
            arranging={arranging}
            onBack={goDrive}
            onFormat={() =>
              go(router, paperHref({ id: opened.id, format: true }), "land")
            }
            onArrange={() =>
              go(
                router,
                paperHref({ id: opened.id, arrange: !arranging }),
                "land",
              )
            }
          />
        ) : null}
      </PaperToolbar>

      <div className="min-h-0 flex-1">
        {mode === "gallery" ? (
          <CvGallery
            current={
              opened && isCvPaper(opened) ? opened.theme.template : undefined
            }
            travelName={galleryTravelName || undefined}
            onBack={() =>
              go(router, opened ? paperHref({ id: opened.id }) : paperHref(), "land")
            }
            onPick={(template) => {
              if (opened && isCvPaper(opened)) {
                dispatch(
                  "paper.setTheme",
                  { id: opened.id, ...themeForTemplate[template] },
                  { silent: true },
                );
                go(router, paperHref({ id: opened.id }), "open");
                return;
              }
              createCv(template, false);
            }}
          />
        ) : null}
        {mode === "letter" ? (
          <LetterChooser
            onBack={() =>
              go(router, opened ? paperHref({ id: opened.id }) : paperHref(), "land")
            }
            onPick={(situation, extras) => {
              if (opened && isLetterPaper(opened)) {
                dispatch(
                  "paper.setLetterSituation",
                  { id: opened.id, situation },
                  { silent: true },
                );
                if (extras.org || extras.role) {
                  dispatch(
                    "paper.setLetterMeta",
                    {
                      id: opened.id,
                      ...(extras.org ? { org: extras.org } : {}),
                      ...(extras.role ? { targetRole: extras.role } : {}),
                    },
                    { silent: true },
                  );
                }
                go(router, paperHref({ id: opened.id }), "land");
                return;
              }
              createLetter(situation, extras);
            }}
          />
        ) : null}
        {mode === "docs" && opened ? (
          <Opened
            paper={opened}
            fromUpload={fromUpload}
            arranging={arranging}
            onBack={goDrive}
            onFormat={() =>
              go(router, paperHref({ id: opened.id, format: true }), "land")
            }
            onArrange={() =>
              go(
                router,
                paperHref({ id: opened.id, arrange: !arranging }),
                "land",
              )
            }
          />
        ) : null}
        {mode === "drive" ? (
          <Drive
            filter={filter}
            onOpen={(openId, extras) =>
              go(
                router,
                paperHref({ id: openId, fromUpload: extras?.fromUpload }),
                extras?.fromUpload ? "land" : "open",
              )
            }
            onRequestCreateCv={() =>
              go(router, paperHref({ creating: "cv" }), "land")
            }
            onWillCreate={onWillCreate}
          />
        ) : null}
      </div>
    </div>
  );
}

function ChooserBand({ title, onBack }: { title: string; onBack: () => void }) {
  const { t, m } = useT();
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label={t(m.paper.backToList)}
        onClick={onBack}
      >
        {t(m.paper.backToList)}
      </Button>
      <h1 className="text-sm font-semibold">{title}</h1>
    </>
  );
}
