"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FolderDocType, SvgDocType } from "@/lib/db";
import type { FileActions, MenuTarget, RenameTarget } from "@/lib/file-actions";

type FileDialogsProps = {
  svgs: SvgDocType[];
  folders: FolderDocType[];
  actions: FileActions;
  /** The file or folder being renamed; null = closed. */
  rename: RenameTarget | null;
  onRenameClose: () => void;
  /** A folder, or several files, awaiting delete confirmation; null = closed. */
  del: MenuTarget | null;
  onDeleteClose: () => void;
};

const plural = (n: number, word: string) =>
  `${n} ${n === 1 ? word : `${word}s`}`;

/**
 * The rename and delete-confirm dialogs, driven by page state so ⌘G and
 * "New folder" can open a rename right after creating the folder.
 */
export function FileDialogs({
  svgs,
  folders,
  actions,
  rename,
  onRenameClose,
  del,
  onDeleteClose,
}: FileDialogsProps) {
  const renameName =
    rename?.kind === "folder"
      ? folders.find((f) => f.id === rename.id)?.name
      : rename
        ? svgs.find((s) => s.id === rename.id)?.name
        : undefined;
  const [renameText, setRenameText] = useState("");
  useEffect(() => {
    // Reseed when a different target opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRenameText(renameName ?? "");
  }, [rename?.id, renameName]);

  function commitRename() {
    if (!rename) return;
    const name = renameText.trim();
    if (name && name !== renameName) {
      if (rename.kind === "folder") actions.renameFolder(rename.id, name);
      else actions.renameSvg(rename.id, name);
    }
    onRenameClose();
  }

  const deleting =
    del?.kind === "folder"
      ? {
          title: `Delete “${folders.find((f) => f.id === del.id)?.name ?? "folder"}”?`,
          count: svgs.filter((s) => s.folderId === del.id).length,
          confirm: "Delete folder",
        }
      : del?.kind === "files"
        ? {
            title: `Delete ${plural(del.ids.length, "file")}?`,
            count: del.ids.length,
            confirm: `Delete ${plural(del.ids.length, "file")}`,
          }
        : null;

  return (
    <>
      <Dialog
        open={rename !== null && renameName !== undefined}
        onOpenChange={(open) => !open && onRenameClose()}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Rename {rename?.kind === "file" ? "file" : "folder"}
            </DialogTitle>
            <DialogDescription>
              Give “{renameName}” a new name.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                commitRename();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={onRenameClose}>
              Cancel
            </Button>
            <Button onClick={commitRename} disabled={!renameText.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && onDeleteClose()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleting?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {del?.kind === "folder"
                ? deleting?.count === 0
                  ? "The folder is empty and will be removed."
                  : `The folder and the ${plural(deleting?.count ?? 0, "file")} inside it will be deleted. This can't be undone.`
                : "This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
              onClick={() => {
                if (del?.kind === "folder") actions.removeFolder(del.id);
                else if (del?.kind === "files") actions.removeSvgs(del.ids);
                onDeleteClose();
              }}
            >
              {deleting?.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
