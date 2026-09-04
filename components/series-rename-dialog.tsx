"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { applySeriesRename } from "@/lib/rename";
import type { SvgDocType } from "@/lib/db";
import { ArrowRightIcon } from "lucide-react";

type SeriesRenameDialogProps = {
  files: SvgDocType[] | null;
  onOpenChange: (open: boolean) => void;
  onRename: (updates: { id: string; name: string }[]) => void;
};

const TOKENS = [
  { label: "Current name", token: "$name" },
  { label: "Number ↑", token: "$n↑" },
  { label: "Number ↓", token: "$n↓" },
];

/**
 * Figma-style batch rename: an optional Match narrows what gets replaced, the
 * Rename-to template supports name/number tokens, and every change previews
 * live before anything is committed.
 */
export function SeriesRenameDialog({
  files,
  onOpenChange,
  onRename,
}: SeriesRenameDialogProps) {
  const [match, setMatch] = useState("");
  const [renameTo, setRenameTo] = useState("");
  const [startFrom, setStartFrom] = useState(1);
  const renameToRef = useRef<HTMLInputElement | null>(null);

  const open = !!files && files.length > 0;
  const names = useMemo(() => files?.map((f) => f.name) ?? [], [files]);
  const preview = useMemo(
    () => applySeriesRename(names, { match, renameTo, startFrom }),
    [names, match, renameTo, startFrom],
  );
  const changed = preview.some((name, i) => name !== names[i]);

  const insertToken = (token: string) => {
    const input = renameToRef.current;
    if (!input) {
      setRenameTo((prev) => prev + token);
      return;
    }
    const start = input.selectionStart ?? renameTo.length;
    const end = input.selectionEnd ?? renameTo.length;
    const next = renameTo.slice(0, start) + token + renameTo.slice(end);
    setRenameTo(next);
    requestAnimationFrame(() => {
      input.focus();
      const caret = start + token.length;
      input.setSelectionRange(caret, caret);
    });
  };

  const commit = () => {
    if (!files || !changed) return;
    onRename(
      files
        .map((file, i) => ({ id: file.id, name: preview[i] }))
        .filter((u, i) => u.name !== names[i]),
    );
    close();
  };

  const close = () => {
    setMatch("");
    setRenameTo("");
    setStartFrom(1);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Rename {names.length} {names.length === 1 ? "file" : "files"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Input
            placeholder="Match (optional)"
            aria-label="Match"
            value={match}
            onChange={(e) => setMatch(e.target.value)}
          />
          <Input
            ref={renameToRef}
            placeholder="Rename to"
            aria-label="Rename to"
            autoFocus
            value={renameTo}
            onChange={(e) => setRenameTo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) commit();
            }}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {TOKENS.map(({ label, token }) => (
              <Button
                key={token}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertToken(token)}
              >
                {label}
              </Button>
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              <label
                htmlFor="series-start"
                className="text-muted-foreground text-xs"
              >
                Start ascending from
              </label>
              <Input
                id="series-start"
                type="number"
                min={0}
                className="h-8 w-16"
                value={startFrom}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  setStartFrom(Number.isFinite(n) ? n : 1);
                }}
              />
            </div>
          </div>

          <ul
            aria-label="Preview"
            className="border-border bg-muted/30 max-h-48 overflow-y-auto rounded-md border p-2 font-mono text-xs"
          >
            {names.map((name, i) => (
              <li key={files![i].id} className="flex items-center gap-2 py-0.5">
                <span className="text-muted-foreground min-w-0 flex-1 truncate">
                  {name}
                </span>
                <ArrowRightIcon className="text-muted-foreground size-3 shrink-0" />
                <span
                  className={
                    preview[i] !== name
                      ? "text-foreground min-w-0 flex-1 truncate"
                      : "text-muted-foreground min-w-0 flex-1 truncate"
                  }
                >
                  {preview[i]}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={commit} disabled={!changed}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
