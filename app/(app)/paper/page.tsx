"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PaperToolbar } from "@/components/paper/toolbar";
import { Button } from "@/components/ui/button";
import { useAppState, useDispatch } from "@/lib/actions/store";
import { themeForTemplate, wordForTemplate } from "@/lib/paper/cv";
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

function hrefFor(
  opts: {
    id?: string;
    creating?: "cv" | "letter";
    format?: boolean;
    arrange?: boolean;
    fromUpload?: boolean;
  } = {},
) {
  const params = new URLSearchParams();
  if (opts.id) params.set("id", opts.id);
  if (opts.creating) params.set("new", opts.creating);
  if (opts.format) params.set("format", "1");
  if (opts.arrange) params.set("arrange", "1");
  if (opts.fromUpload) params.set("from", "upload");
  const query = params.toString();
  return query ? `/paper?${query}` : "/paper";
}

function go(router: ReturnType<typeof useRouter>, href: string) {
  const run = () => router.replace(href, { scroll: false });
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || typeof document.startViewTransition !== "function") {
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

  const pending = React.useRef(false);
  const pendingFromUpload = React.useRef(false);

  React.useEffect(() => {
    if (!pending.current) return;
    const newest = paper.at(-1);
    if (!newest) return;
    pending.current = false;
    const upload = pendingFromUpload.current;
    pendingFromUpload.current = false;
    go(router, hrefFor({ id: newest.id, fromUpload: upload }));
  }, [paper, router]);

  React.useEffect(() => {
    if (id && !paper.some((item) => item.id === id)) {
      go(router, hrefFor());
    }
  }, [id, paper, router]);

  const goDrive = () => go(router, hrefFor());
  const onWillCreate = (opts?: { fromUpload?: boolean }) => {
    pending.current = true;
    pendingFromUpload.current = Boolean(opts?.fromUpload);
  };

  const createCv = (template: CvTemplate, fromProfile: boolean) => {
    const role = profile.identity.targetRole.trim();
    const word = wordForTemplate(template);
    onWillCreate();
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

  const gallery = creating === "cv" || Boolean(format && opened && isCvPaper(opened));
  const letterChooser =
    creating === "letter" || Boolean(format && opened && isLetterPaper(opened));
  const docs = Boolean(opened) && !gallery && !letterChooser;
  const drive = !opened && !creating;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PaperToolbar>
        {drive ? (
          <DriveBand
            filter={filter}
            onFilter={setFilter}
            onRequestCreateCv={() => go(router, hrefFor({ creating: "cv" }))}
            onRequestCreateLetter={() => go(router, hrefFor({ creating: "letter" }))}
            onWillCreate={onWillCreate}
          />
        ) : null}
        {gallery ? (
          <ChooserBand
            title={t(m.paper.galleryTitle)}
            onBack={() =>
              go(router, opened ? hrefFor({ id: opened.id }) : hrefFor())
            }
          />
        ) : null}
        {letterChooser ? (
          <ChooserBand
            title={t(m.paper.letterChooserTitle)}
            onBack={() =>
              go(router, opened ? hrefFor({ id: opened.id }) : hrefFor())
            }
          />
        ) : null}
        {docs && opened ? (
          <OpenedBand
            paper={opened}
            arranging={arranging}
            onBack={goDrive}
            onFormat={() => go(router, hrefFor({ id: opened.id, format: true }))}
            onArrange={() =>
              go(
                router,
                hrefFor({ id: opened.id, arrange: !arranging }),
              )
            }
          />
        ) : null}
      </PaperToolbar>

      <div className="min-h-0 flex-1">
        {gallery ? (
          <CvGallery
            current={
              opened && isCvPaper(opened) ? opened.theme.template : undefined
            }
            onBack={() =>
              go(router, opened ? hrefFor({ id: opened.id }) : hrefFor())
            }
            onPick={(template) => {
              if (opened && isCvPaper(opened)) {
                dispatch(
                  "paper.setTheme",
                  { id: opened.id, ...themeForTemplate[template] },
                  { silent: true },
                );
                go(router, hrefFor({ id: opened.id }));
                return;
              }
              createCv(template, false);
            }}
          />
        ) : null}
        {letterChooser ? (
          <LetterChooser
            onBack={() =>
              go(router, opened ? hrefFor({ id: opened.id }) : hrefFor())
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
                go(router, hrefFor({ id: opened.id }));
                return;
              }
              createLetter(situation, extras);
            }}
          />
        ) : null}
        {docs && opened ? (
          <Opened
            paper={opened}
            fromUpload={fromUpload}
            arranging={arranging}
            onBack={goDrive}
            onFormat={() => go(router, hrefFor({ id: opened.id, format: true }))}
            onArrange={() =>
              go(router, hrefFor({ id: opened.id, arrange: !arranging }))
            }
          />
        ) : null}
        {drive ? (
          <Drive
            filter={filter}
            onOpen={(openId, extras) =>
              go(router, hrefFor({ id: openId, fromUpload: extras?.fromUpload }))
            }
            onRequestCreateCv={() => go(router, hrefFor({ creating: "cv" }))}
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
      <h1 className="text-sm font-medium">{title}</h1>
    </>
  );
}
