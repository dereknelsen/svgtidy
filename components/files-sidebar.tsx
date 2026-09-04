"use client";

import { memo, useMemo, useState, type Ref } from "react";
import {
  ChevronRightIcon,
  DownloadIcon,
  FolderIcon,
  FolderOpenIcon,
  MoreHorizontalIcon,
  PencilIcon,
  TextCursorInputIcon,
  Trash2Icon,
  CopyIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { AddFilesButton, type IncomingSvg } from "@/components/dropzone";
import { formatPercent } from "@/lib/format";
import { isStale, savingsOf, type ResultMap } from "@/lib/optimize";
import { useSvgObjectUrl } from "@/hooks/use-object-url";
import type { FolderDocType, SvgDocType } from "@/lib/db";
import { cn } from "@/lib/utils";

export type FileActions = {
  removeSvg: (id: string) => void;
  duplicateSvg: (id: string) => void;
  downloadSvg: (id: string) => void;
  renameSvg: (id: string, name: string) => void;
  renameFolder: (id: string, name: string) => void;
  removeFolder: (id: string) => void;
  duplicateFolder: (id: string) => void;
  downloadFolder: (id: string) => void;
  /** Open the series rename dialog for a folder's files. */
  seriesRename: (folderId: string) => void;
  clearAll: () => void;
};

type FilesSidebarProps = {
  svgs: SvgDocType[];
  folders: FolderDocType[];
  results: ResultMap;
  selectedId: string | null;
  onSelect: (id: string) => void;
  actions: FileActions;
  /** The [+] button next to the filter feeds picked files here. */
  onAddFiles: (files: IncomingSvg[]) => void;
  /** For the Mod+F focus hotkey. */
  filterRef?: Ref<HTMLInputElement>;
};

/* ---------------------------------- rows ---------------------------------- */

function SvgThumb({ svg, className }: { svg: string; className?: string }) {
  const url = useSvgObjectUrl(svg);
  return (
    <span
      className={cn(
        "bg-muted/50 grid size-5 shrink-0 place-items-center overflow-hidden rounded-sm",
        className,
      )}
      aria-hidden
    >
      {url && <img src={url} alt="" className="size-[75%] object-contain" />}
    </span>
  );
}

/** Savings percent, dimmed while a re-optimize runs. */
function SavingsTag({ svg, results }: { svg: SvgDocType; results: ResultMap }) {
  const result = results[svg.id];
  const pct = savingsOf(svg, result);
  return (
    <span
      className={cn(
        "ml-auto shrink-0 font-mono text-[10px] tabular-nums transition-opacity duration-150",
        isStale(result) && "opacity-60",
        pct != null && pct > 0 ? "text-success" : "text-muted-foreground",
      )}
    >
      {pct != null ? formatPercent(pct) : "…"}
    </span>
  );
}

function FileMenu({
  onRename,
  onDuplicate,
  onDownload,
  onDelete,
  className,
}: {
  onRename: () => void;
  onDuplicate: () => void;
  onDownload: () => void;
  onDelete: () => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuAction
            showOnHover
            className={className}
            aria-label="File actions"
          />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start">
        <DropdownMenuItem onClick={onRename}>
          <PencilIcon />
          Rename…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <CopyIcon />
          Duplicate
          <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDownload}>
          <DownloadIcon />
          Download
          <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2Icon />
          Delete
          <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type FileRowProps = {
  svg: SvgDocType;
  results: ResultMap;
  selected: boolean;
  onSelect: (id: string) => void;
  actions: FileActions;
  onRenameRequest: (svg: SvgDocType) => void;
  /** Render as a sub-row inside a folder. */
  sub?: boolean;
};

const FileRow = memo(function FileRow({
  svg,
  results,
  selected,
  onSelect,
  actions,
  onRenameRequest,
  sub = false,
}: FileRowProps) {
  const content = (
    <>
      <SvgThumb svg={svg.svg} />
      <span className="min-w-0 flex-1 truncate">{svg.name}</span>
      <SavingsTag svg={svg} results={results} />
    </>
  );
  const menu = (
    <FileMenu
      className={sub ? "top-1" : undefined}
      onRename={() => onRenameRequest(svg)}
      onDuplicate={() => actions.duplicateSvg(svg.id)}
      onDownload={() => actions.downloadSvg(svg.id)}
      onDelete={() => actions.removeSvg(svg.id)}
    />
  );

  if (sub) {
    return (
      <SidebarMenuSubItem className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
        <SidebarMenuSubButton
          isActive={selected}
          render={<button type="button" onClick={() => onSelect(svg.id)} />}
          className="w-full pr-7"
        >
          {content}
        </SidebarMenuSubButton>
        {menu}
      </SidebarMenuSubItem>
    );
  }
  return (
    <SidebarMenuItem className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
      <SidebarMenuButton
        isActive={selected}
        tooltip={svg.name}
        onClick={() => onSelect(svg.id)}
      >
        {content}
      </SidebarMenuButton>
      {menu}
    </SidebarMenuItem>
  );
});

type FolderRowProps = {
  folder: FolderDocType;
  files: SvgDocType[];
  results: ResultMap;
  selectedId: string | null;
  onSelect: (id: string) => void;
  actions: FileActions;
  /** A filter query forces folders open. */
  forceOpen: boolean;
  onRenameRequest: (folder: FolderDocType) => void;
  onFileRenameRequest: (svg: SvgDocType) => void;
  onDeleteRequest: (folder: FolderDocType, count: number) => void;
};

function FolderRow({
  folder,
  files,
  results,
  selectedId,
  onSelect,
  actions,
  forceOpen,
  onRenameRequest,
  onFileRenameRequest,
  onDeleteRequest,
}: FolderRowProps) {
  const [open, setOpen] = useState(true);
  const { state, setOpen: setSidebarOpen } = useSidebar();
  const isOpen = forceOpen || open;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setOpen}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger
          render={
            <SidebarMenuButton
              tooltip={folder.name}
              onClick={() => {
                // In the icon rail, folder contents are hidden — expand the
                // sidebar instead of toggling an invisible panel.
                if (state === "collapsed") setSidebarOpen(true);
              }}
            />
          }
        >
          <ChevronRightIcon
            className={cn(
              "text-muted-foreground transition-transform",
              isOpen && "rotate-90",
            )}
          />
          {isOpen ? <FolderOpenIcon /> : <FolderIcon />}
          <span className="min-w-0 flex-1 truncate">{folder.name}</span>
          <span className="text-muted-foreground shrink-0 font-mono text-[10px] tabular-nums">
            {files.length}
          </span>
        </CollapsibleTrigger>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuAction showOnHover aria-label="Folder actions" />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start">
            <DropdownMenuItem onClick={() => onRenameRequest(folder)}>
              <PencilIcon />
              Rename…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.seriesRename(folder.id)}>
              <TextCursorInputIcon />
              Rename files…
              <DropdownMenuShortcut>⌘R</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => actions.duplicateFolder(folder.id)}
            >
              <CopyIcon />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.downloadFolder(folder.id)}>
              <DownloadIcon />
              Download ZIP
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDeleteRequest(folder, files.length)}
            >
              <Trash2Icon />
              Delete…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <CollapsibleContent>
          <SidebarMenuSub className="mr-0 pr-0">
            {files.map((svg) => (
              <FileRow
                key={svg.id}
                svg={svg}
                results={results}
                selected={svg.id === selectedId}
                onSelect={onSelect}
                actions={actions}
                onRenameRequest={onFileRenameRequest}
                sub
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

/* ------------------------------ date grouping ------------------------------ */

type Entry =
  | { kind: "folder"; folder: FolderDocType; files: SvgDocType[]; at: number }
  | { kind: "file"; svg: SvgDocType; at: number };

const BUCKETS = ["Today", "Yesterday", "This week", "Earlier"] as const;
type Bucket = (typeof BUCKETS)[number];

function bucketOf(at: number, now: Date): Bucket {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = 24 * 60 * 60 * 1000;
  if (at >= startOfDay.getTime()) return "Today";
  if (at >= startOfDay.getTime() - day) return "Yesterday";
  if (at >= startOfDay.getTime() - 6 * day) return "This week";
  return "Earlier";
}

/* --------------------------------- sidebar --------------------------------- */

export function FilesSidebar({
  svgs,
  folders,
  results,
  selectedId,
  onSelect,
  actions,
  onAddFiles,
  filterRef,
}: FilesSidebarProps) {
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<
    | { kind: "folder"; id: string; name: string }
    | { kind: "file"; id: string; name: string }
    | null
  >(null);
  const [renameText, setRenameText] = useState("");
  const [deleting, setDeleting] = useState<{
    folder: FolderDocType;
    count: number;
  } | null>(null);

  const q = query.trim().toLowerCase();

  const grouped = useMemo(() => {
    const byFolder = new Map<string, SvgDocType[]>();
    const loose: SvgDocType[] = [];
    for (const svg of svgs) {
      if (svg.folderId) {
        const list = byFolder.get(svg.folderId) ?? [];
        list.push(svg);
        byFolder.set(svg.folderId, list);
      } else {
        loose.push(svg);
      }
    }

    let entries: Entry[] = [
      ...folders.map((folder) => ({
        kind: "folder" as const,
        folder,
        files: byFolder.get(folder.id) ?? [],
        at: folder.createdAt,
      })),
      // Files whose folder no longer exists count as loose.
      ...[...byFolder.entries()]
        .filter(([id]) => !folders.some((f) => f.id === id))
        .flatMap(([, files]) => files)
        .concat(loose)
        .map((svg) => ({ kind: "file" as const, svg, at: svg.createdAt })),
    ];

    if (q) {
      entries = entries.flatMap((entry): Entry[] => {
        if (entry.kind === "file") {
          return entry.svg.name.toLowerCase().includes(q) ? [entry] : [];
        }
        if (entry.folder.name.toLowerCase().includes(q)) return [entry];
        const files = entry.files.filter((f) =>
          f.name.toLowerCase().includes(q),
        );
        return files.length > 0 ? [{ ...entry, files }] : [];
      });
    }

    entries.sort((a, b) => b.at - a.at);

    const now = new Date();
    const buckets = new Map<Bucket, Entry[]>();
    for (const entry of entries) {
      const bucket = bucketOf(entry.at, now);
      buckets.set(bucket, [...(buckets.get(bucket) ?? []), entry]);
    }
    return buckets;
  }, [svgs, folders, q]);

  const empty = [...grouped.values()].every((list) => list.length === 0);

  async function commitRename() {
    if (!renaming) return;
    const name = renameText.trim();
    if (name) {
      if (renaming.kind === "folder") actions.renameFolder(renaming.id, name);
      else actions.renameSvg(renaming.id, name);
    }
    setRenaming(null);
  }

  return (
    <Sidebar side="left" collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
          <SidebarInput
            ref={filterRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter files…"
            aria-label="Filter files"
          />
          <AddFilesButton onFiles={onAddFiles} />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {empty ? (
          <p className="text-muted-foreground px-4 py-8 text-center text-sm group-data-[collapsible=icon]:hidden">
            {q ? `No files match “${query.trim()}”` : "No files yet"}
          </p>
        ) : (
          BUCKETS.map((bucket) => {
            const entries = grouped.get(bucket);
            if (!entries || entries.length === 0) return null;
            return (
              <SidebarGroup key={bucket} className="py-0">
                <SidebarGroupLabel>{bucket}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {entries.map((entry) =>
                      entry.kind === "folder" ? (
                        <FolderRow
                          key={entry.folder.id}
                          folder={entry.folder}
                          files={entry.files}
                          results={results}
                          selectedId={selectedId}
                          onSelect={onSelect}
                          actions={actions}
                          forceOpen={q.length > 0}
                          onRenameRequest={(folder) => {
                            setRenaming({
                              kind: "folder",
                              id: folder.id,
                              name: folder.name,
                            });
                            setRenameText(folder.name);
                          }}
                          onFileRenameRequest={(svg) => {
                            setRenaming({
                              kind: "file",
                              id: svg.id,
                              name: svg.name,
                            });
                            setRenameText(svg.name);
                          }}
                          onDeleteRequest={(folder, count) =>
                            setDeleting({ folder, count })
                          }
                        />
                      ) : (
                        <FileRow
                          key={entry.svg.id}
                          svg={entry.svg}
                          results={results}
                          selected={entry.svg.id === selectedId}
                          onSelect={onSelect}
                          actions={actions}
                          onRenameRequest={(svg) => {
                            setRenaming({
                              kind: "file",
                              id: svg.id,
                              name: svg.name,
                            });
                            setRenameText(svg.name);
                          }}
                        />
                      ),
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })
        )}
      </SidebarContent>

      {svgs.length > 0 && (
        <SidebarFooter className="group-data-[collapsible=icon]:hidden">
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground hover:text-destructive justify-start"
            onClick={actions.clearAll}
          >
            <Trash2Icon />
            Remove all files
          </Button>
        </SidebarFooter>
      )}
      <SidebarRail />

      {/* Rename folder or file */}
      <Dialog
        open={renaming !== null}
        onOpenChange={(open) => !open && setRenaming(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Rename {renaming?.kind === "file" ? "file" : "folder"}
            </DialogTitle>
            <DialogDescription>
              Give “{renaming?.name}” a new name.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                commitRename();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button onClick={commitRename} disabled={!renameText.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete folder confirmation */}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete “{deleting?.folder.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.count === 0
                ? "The folder is empty and will be removed."
                : `The folder and the ${deleting?.count} ${
                    deleting?.count === 1 ? "file" : "files"
                  } inside it will be deleted. This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
              onClick={() => {
                if (deleting) actions.removeFolder(deleting.folder.id);
                setDeleting(null);
              }}
            >
              Delete folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}
