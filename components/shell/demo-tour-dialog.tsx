"use client";

import { Compass } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const TOUR_STOPS = [
  { title: "Opportunities", detail: "Where every role you're tracking lives, with Copilot's fit judgment on each one." },
  { title: "Opportunity detail", detail: "A summary, a fit and credibility read, next actions, and materials, all in one place." },
  { title: "Career Memory", detail: "Profile, CV Versions, and Track Record: the evidence that persists past any one application." },
  { title: "Direction", detail: "Goals and Skills & Learning, tracking the move toward AI product design and leadership." },
];

export function DemoTourDialog({ children }: { children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Compass className="size-4 text-muted-foreground" />
            <DialogTitle>Demo tour</DialogTitle>
          </div>
          <DialogDescription>A quick walk through OpenPath&rsquo;s four main areas.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          {TOUR_STOPS.map((stop, index) => (
            <div key={stop.title} className="flex gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {index + 1}
              </span>
              <div>
                <p className="font-medium text-foreground">{stop.title}</p>
                <p className="text-muted-foreground">{stop.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Got it</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
