"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import type { CvVersion } from "@/lib/types";

interface DeleteCvDialogProps {
  cv: CvVersion | null;
  onClose: () => void;
  /** Called after the delete completes, for example to navigate away from the deleted version's detail page. */
  onDeleted?: () => void;
}

/**
 * Confirm-before-delete for a CV version. If the version is linked to an
 * opportunity, that link is cleared along with it.
 */
export function DeleteCvDialog({ cv, onClose, onDeleted }: DeleteCvDialogProps) {
  const { deleteCvVersion } = useStore();

  function handleDelete() {
    if (!cv) return;
    deleteCvVersion(cv.id);
    onClose();
    onDeleted?.();
  }

  return (
    <Dialog open={cv !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete this version?</DialogTitle>
          <DialogDescription>
            {cv ? (
              <>
                {cv.name} will be removed
                {cv.opportunityId ? ", and its opportunity link will be cleared" : ""}. This cannot be
                undone.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleDelete}>
            Delete version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
