"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type Ref,
} from "react";
import {
  ChevronRightIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useSvgFilePicker, type IncomingSvg } from "@/components/dropzone";
import {
  FileMenuItems,
  MenuContextProvider,
  contextKit,
  dropdownKit,
  type MenuContextValue,
} from "@/components/file-menu-items";
import { formatPercent } from "@/lib/format";
import { isStale, savingsOf, type ResultMap } from "@/lib/optimize";
import { useSvgObjectUrl } from "@/hooks/use-object-url";
import type { FolderDocType, SvgDocType } from "@/lib/db";
import type { FileActions, MenuTarget, RenameTarget } from "@/lib/file-actions";
import { BUCKETS, groupEntries, visibleFileOrder } from "@/lib/file-tree";
import { overrideCount } from "@/lib/effective-settings";
import { SVGTIDY_IDS_MIME, isInternalDrag, readDraggedIds } from "@/lib/dnd";
import type { SelectModifiers, Selection } from "@/lib/selection";
import { cn } from "@/lib/utils";

export type { FileActions } from "@/lib/file-actions";

type FilesSidebarProps = {
  svgs: SvgDocType[];
  folders: FolderDocType[];
  results: ResultMap;
  selection: Selection;
  /** The files rendered as selected (the explicit set, or just the anchor). */
  selectedFileIds: ReadonlySet<string>;
  onSelect: (
    id: string,
    mods: SelectModifiers,
    visibleOrder: readonly string[],
  ) => void;
  onSelectFolder: (id: string | null) => void;
  onClearSelection: () => void;
  actions: FileActions;
  onAddFiles: (files: IncomingSvg[]) => void;
  onRenameRequest: (target: RenameTarget) => void;
  onDeleteRequest: (target: MenuTarget) => void;
  /** For the Mod+F focus hotkey. */
  filterRef?: Ref<HTMLInputElement>;
};

const modsOf = (e: MouseEvent): SelectModifiers => ({
  shift: e.shiftKey,
  meta: e.metaKey || e.ctrlKey,
});

const plural = (n: number, word: string) =>
  `${n} ${n === 1 ? word : `${word}s`}`;

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

/** A small dot: this file or folder pins some settings of its own. */
function OverrideDot({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      className="bg-primary/70 size-1.5 shrink-0 rounded-full"
      title={`${plural(count, "setting")} overridden`}
      aria-label={`${plural(count, "setting")} overridden`}
    />
  );
}

/** The hover-revealed "…" menu on a row. Same items as the context menu. */
function RowMenu({
  target,
  label,
  className,
}: {
  target: MenuTarget;
  label: string;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuAction
            showOnHover
            className={className}
            aria-label={label}
          />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start">
        <FileMenuItems kit={dropdownKit} target={target} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type FileRowProps = {
  svg: SvgDocType;
  results: ResultMap;
  selected: boolean;
  dimmed: boolean;
  draggable: boolean;
  onSelect: (id: string, mods: SelectModifiers) => void;
  onDragStart: (id: string, e: DragEvent) => void;
  onDragEnd: () => void;
  /** The "…" menu acts on the whole selection when this row is part of it. */
  menuTargetFor: (id: string) => MenuTarget;
  /** Render as a sub-row inside a folder. */
  sub?: boolean;
};

const FileRow = memo(function FileRow({
  svg,
  results,
  selected,
  dimmed,
  draggable,
  onSelect,
  onDragStart,
  onDragEnd,
  menuTargetFor,
  sub = false,
}: FileRowProps) {
  const overrides = overrideCount(svg.override);
  const content = (
    <>
      <SvgThumb svg={svg.svg} />
      <span className="min-w-0 flex-1 text-start truncate">{svg.name}</span>
      <OverrideDot count={overrides} />
      <SavingsTag svg={svg} results={results} />
    </>
  );
  const dragProps = {
    draggable,
    onDragStart: (e: DragEvent) => onDragStart(svg.id, e),
    onDragEnd,
  };
  // The menu target is resolved when the menu opens, not at render, so the
  // row stays memoized while the selection changes around it.
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const menu = (
    <span
      onPointerDown={() => setMenuTarget(menuTargetFor(svg.id))}
      onKeyDown={() => setMenuTarget(menuTargetFor(svg.id))}
      className="contents"
    >
      <RowMenu
        className={sub ? "top-1" : undefined}
        label="File actions"
        target={menuTarget ?? { kind: "files", ids: [svg.id] }}
      />
    </span>
  );
  const rowClass = cn(
    "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200",
    dimmed && "opacity-50",
  );

  if (sub) {
    return (
      <SidebarMenuSubItem className={rowClass} data-file-id={svg.id}>
        <SidebarMenuSubButton
          isActive={selected}
          render={
            <button
              type="button"
              onClick={(e) => onSelect(svg.id, modsOf(e))}
              {...dragProps}
            />
          }
          className="w-full pr-7"
        >
          {content}
        </SidebarMenuSubButton>
        {menu}
      </SidebarMenuSubItem>
    );
  }
  return (
    <SidebarMenuItem className={rowClass} data-file-id={svg.id}>
      <SidebarMenuButton
        isActive={selected}
        tooltip={svg.name}
        onClick={(e) => onSelect(svg.id, modsOf(e))}
        {...dragProps}
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
  selected: boolean;
  selectedFileIds: ReadonlySet<string>;
  dragging: string[] | null;
  dropTarget: boolean;
  draggable: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string, mods: SelectModifiers) => void;
  onSelectFolder: (id: string) => void;
  onDragStart: (id: string, e: DragEvent) => void;
  onDragEnd: () => void;
  onDropTarget: (id: string | null) => void;
  onDropFiles: (ids: string[], folderId: string) => void;
  menuTargetFor: (id: string) => MenuTarget;
};

function FolderRow({
  folder,
  files,
  results,
  selected,
  selectedFileIds,
  dragging,
  dropTarget,
  draggable,
  open,
  onOpenChange,
  onSelect,
  onSelectFolder,
  onDragStart,
  onDragEnd,
  onDropTarget,
  onDropFiles,
  menuTargetFor,
}: FolderRowProps) {
  const { state, setOpen: setSidebarOpen } = useSidebar();
  const expandTimer = useRef<number | null>(null);
  const clearExpandTimer = () => {
    if (expandTimer.current != null) {
      window.clearTimeout(expandTimer.current);
      expandTimer.current = null;
    }
  };
  // Dropping files onto the folder they all already live in is a no-op.
  const allInside =
    !!dragging && dragging.every((id) => files.some((f) => f.id === id));
  const overrides = overrideCount(folder.override);

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="group/collapsible"
    >
      <SidebarMenuItem
        data-folder-id={folder.id}
        onDragEnter={(e) => {
          if (!isInternalDrag(e.dataTransfer)) return;
          e.stopPropagation();
          if (!open && expandTimer.current == null) {
            expandTimer.current = window.setTimeout(() => {
              expandTimer.current = null;
              onOpenChange(true);
            }, 600);
          }
        }}
        onDragOver={(e) => {
          if (!isInternalDrag(e.dataTransfer)) return;
          e.stopPropagation();
          if (allInside) {
            e.dataTransfer.dropEffect = "none";
            return;
          }
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (!dropTarget) onDropTarget(folder.id);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          clearExpandTimer();
          if (dropTarget) onDropTarget(null);
        }}
        onDrop={(e) => {
          if (!isInternalDrag(e.dataTransfer)) return;
          e.preventDefault();
          e.stopPropagation();
          clearExpandTimer();
          const ids = readDraggedIds(e.dataTransfer) ?? dragging ?? [];
          onDropTarget(null);
          if (ids.length > 0 && !allInside) onDropFiles(ids, folder.id);
        }}
      >
        <SidebarMenuButton
          isActive={selected}
          tooltip={folder.name}
          data-drop-target={dropTarget || undefined}
          className="data-drop-target:ring-sidebar-ring data-drop-target:bg-sidebar-accent pl-7 data-drop-target:ring-2"
          onClick={(e) => {
            // In the icon rail, folder contents are hidden, so expand the
            // sidebar instead of toggling an invisible panel.
            if (state === "collapsed") setSidebarOpen(true);
            if (e.detail === 2) onOpenChange(!open);
            else onSelectFolder(folder.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" && !open) onOpenChange(true);
            if (e.key === "ArrowLeft" && open) onOpenChange(false);
          }}
        >
          {open ? <FolderOpenIcon /> : <FolderIcon />}
          <span className="min-w-0 flex-1 truncate">{folder.name}</span>
          <OverrideDot count={overrides} />
          <span className="text-muted-foreground shrink-0 font-mono text-[10px] tabular-nums">
            {files.length}
          </span>
        </SidebarMenuButton>
        <CollapsibleTrigger
          render={
            <button
              type="button"
              aria-label={open ? "Collapse folder" : "Expand folder"}
              aria-expanded={open}
              className="text-muted-foreground hover:text-foreground absolute top-2 left-1.5 grid size-4 place-items-center rounded-sm group-data-[collapsible=icon]:hidden"
            />
          }
        >
          <ChevronRightIcon
            className={cn("size-4 transition-transform", open && "rotate-90")}
          />
        </CollapsibleTrigger>
        <RowMenu
          label="Folder actions"
          target={{ kind: "folder", id: folder.id }}
        />
        <CollapsibleContent>
          <SidebarMenuSub className="mr-0 pr-0 gap-px">
            {files.map((svg) => (
              <FileRow
                key={svg.id}
                svg={svg}
                results={results}
                selected={selectedFileIds.has(svg.id)}
                dimmed={dragging?.includes(svg.id) ?? false}
                draggable={draggable}
                onSelect={onSelect}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                menuTargetFor={menuTargetFor}
                sub
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

/* --------------------------------- header --------------------------------- */

/** The [+] menu: add files from disk, or start an empty folder. */
function AddMenu({
  onOpenPicker,
  onNewFolder,
}: {
  onOpenPicker: () => void;
  onNewFolder: () => void;
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <DropdownMenuTrigger
          render={
            <TooltipTrigger
              render={<Button variant="default" size="icon" aria-label="Add" />}
            />
          }
        >
          <PlusIcon />
        </DropdownMenuTrigger>
        <TooltipContent>Add files or a folder</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onOpenPicker}>
          <UploadIcon />
          Add files from computer…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onNewFolder}>
          <FolderPlusIcon />
          New folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* --------------------------------- sidebar --------------------------------- */

export function FilesSidebar({
  svgs,
  folders,
  results,
  selection,
  selectedFileIds,
  onSelect,
  onSelectFolder,
  onClearSelection,
  actions,
  onAddFiles,
  onRenameRequest,
  onDeleteRequest,
  filterRef,
}: FilesSidebarProps) {
  const { state, isMobile } = useSidebar();
  const isRail = state === "collapsed";
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  // Folders default open; track the closed ones. A filter forces all open.
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const isFolderOpen = useCallback(
    (id: string) => q.length > 0 || !collapsedIds.has(id),
    [q, collapsedIds],
  );
  const setFolderOpen = useCallback((id: string, open: boolean) => {
    setCollapsedIds((prev) => {
      if (open ? !prev.has(id) : prev.has(id)) return prev;
      const next = new Set(prev);
      if (open) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const grouped = useMemo(
    () => groupEntries(svgs, folders, query),
    [svgs, folders, query],
  );
  const visibleFileIds = useMemo(
    () => visibleFileOrder(grouped, isFolderOpen),
    [grouped, isFolderOpen],
  );
  const empty = [...grouped.values()].every((list) => list.length === 0);

  const handleSelect = useCallback(
    (id: string, mods: SelectModifiers) => onSelect(id, mods, visibleFileIds),
    [onSelect, visibleFileIds],
  );

  // Rows resolve their menu target on open, through a ref, so the memoized
  // rows don't re-render every time the selection changes.
  const selectedRef = useRef(selectedFileIds);
  useEffect(() => {
    selectedRef.current = selectedFileIds;
  });
  const menuTargetFor = useCallback((id: string): MenuTarget => {
    const ids = selectedRef.current;
    return { kind: "files", ids: ids.has(id) ? [...ids] : [id] };
  }, []);

  /* ----------------------------- drag and drop ----------------------------- */

  const [dragging, setDragging] = useState<string[] | null>(null);
  const [dropTarget, setDropTarget] = useState<string | "root" | null>(null);
  const dragBadgeRef = useRef<HTMLDivElement | null>(null);
  const canDrag = !isRail && !isMobile;

  const handleDragStart = useCallback(
    (id: string, e: DragEvent) => {
      const selected = selectedRef.current;
      const ids = selected.has(id) ? [...selected] : [id];
      if (!selected.has(id)) handleSelect(id, {});
      e.dataTransfer.setData(SVGTIDY_IDS_MIME, JSON.stringify(ids));
      e.dataTransfer.effectAllowed = "move";
      if (ids.length > 1 && dragBadgeRef.current) {
        dragBadgeRef.current.textContent = plural(ids.length, "file");
        e.dataTransfer.setDragImage(dragBadgeRef.current, 16, 16);
      }
      setDragging(ids);
    },
    [handleSelect],
  );
  const handleDragEnd = useCallback(() => {
    setDragging(null);
    setDropTarget(null);
  }, []);
  const anyInFolder = useMemo(
    () =>
      !!dragging &&
      dragging.some((id) => svgs.find((s) => s.id === id)?.folderId),
    [dragging, svgs],
  );
  const handleDropFiles = useCallback(
    (ids: string[], folderId: string | null) => {
      setDragging(null);
      setDropTarget(null);
      actions.moveSvgs(ids, folderId);
    },
    [actions],
  );

  /* ------------------------------ menus, picker ----------------------------- */

  const picker = useSvgFilePicker(onAddFiles);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const menuContext = useMemo<MenuContextValue>(
    () => ({
      actions,
      svgs,
      folders,
      onRenameRequest,
      onDeleteRequest,
      onAddFiles: picker.open,
    }),
    [actions, svgs, folders, onRenameRequest, onDeleteRequest, picker.open],
  );

  const [managing, setManaging] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  async function backupAll() {
    setBackingUp(true);
    try {
      await actions.backupAll();
    } finally {
      setBackingUp(false);
    }
  }

  const selectedFolder = selection.folderId
    ? folders.find((f) => f.id === selection.folderId)
    : null;
  const hiddenSelected = useMemo(() => {
    if (selectedFileIds.size <= 1) return 0;
    const visible = new Set(visibleFileIds);
    let n = 0;
    for (const id of selectedFileIds) if (!visible.has(id)) n++;
    return n;
  }, [selectedFileIds, visibleFileIds]);
  const showChip = selectedFileIds.size > 1 || !!selectedFolder;

  return (
    <MenuContextProvider value={menuContext}>
      <Sidebar side="left" collapsible="icon">
        <input {...picker.inputProps} />
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
            <AddMenu
              onOpenPicker={picker.open}
              onNewFolder={actions.newFolder}
            />
          </div>

        </SidebarHeader>

        <ContextMenu
          disabled={isRail}
          onOpenChange={(open) => !open && setMenuTarget(null)}
        >
          <ContextMenuTrigger
            render={<SidebarContent />}
            onClick={(e) => {
              const el = e.target as Element;
              if (el.closest("button,input,a,[role='menu']")) return;
              onClearSelection();
            }}
            onContextMenuCapture={(e) => {
              if (isRail) return;
              const el = e.target as Element;
              const fileId =
                el.closest<HTMLElement>("[data-file-id]")?.dataset.fileId;
              const folderId =
                el.closest<HTMLElement>("[data-folder-id]")?.dataset.folderId;
              if (fileId) {
                const selected = selectedRef.current;
                if (!selected.has(fileId)) handleSelect(fileId, {});
                setMenuTarget({
                  kind: "files",
                  ids: selected.has(fileId) ? [...selected] : [fileId],
                });
              } else if (folderId) {
                onSelectFolder(folderId);
                setMenuTarget({ kind: "folder", id: folderId });
              } else {
                setMenuTarget({ kind: "empty" });
              }
            }}
            onDragOver={(e) => {
              if (!isInternalDrag(e.dataTransfer) || !anyInFolder) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dropTarget !== "root") setDropTarget("root");
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node | null))
                return;
              if (dropTarget === "root") setDropTarget(null);
            }}
            onDrop={(e) => {
              if (!isInternalDrag(e.dataTransfer)) return;
              e.preventDefault();
              const ids = readDraggedIds(e.dataTransfer) ?? dragging ?? [];
              if (ids.length > 0 && anyInFolder) handleDropFiles(ids, null);
              else handleDragEnd();
            }}
          >
            {dragging && anyInFolder && (
              <div
                className={cn(
                  "text-muted-foreground border-border sticky top-0 z-10 mx-2 mt-2 rounded-xl border border-dashed px-3 py-2 text-center text-xs transition-colors group-data-[collapsible=icon]:hidden",
                  dropTarget === "root" &&
                    "border-primary bg-primary/10 text-foreground",
                )}
              >
                Drop here to move out of folder
              </div>
            )}
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
                              selected={selection.folderId === entry.folder.id}
                              selectedFileIds={selectedFileIds}
                              dragging={dragging}
                              dropTarget={dropTarget === entry.folder.id}
                              draggable={canDrag}
                              open={isFolderOpen(entry.folder.id)}
                              onOpenChange={(open) =>
                                setFolderOpen(entry.folder.id, open)
                              }
                              onSelect={handleSelect}
                              onSelectFolder={onSelectFolder}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                              onDropTarget={setDropTarget}
                              onDropFiles={handleDropFiles}
                              menuTargetFor={menuTargetFor}
                            />
                          ) : (
                            <FileRow
                              key={entry.svg.id}
                              svg={entry.svg}
                              results={results}
                              selected={selectedFileIds.has(entry.svg.id)}
                              dimmed={dragging?.includes(entry.svg.id) ?? false}
                              draggable={canDrag}
                              onSelect={handleSelect}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                              menuTargetFor={menuTargetFor}
                            />
                          ),
                        )}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                );
              })
            )}
          </ContextMenuTrigger>
          <ContextMenuContent>
            {menuTarget && (
              <FileMenuItems kit={contextKit} target={menuTarget} />
            )}
          </ContextMenuContent>
        </ContextMenu>

        {/* Offscreen drag image for multi-file drags. */}
        <div
          ref={dragBadgeRef}
          aria-hidden
          className="bg-primary text-primary-foreground pointer-events-none fixed -top-full left-0 rounded-full px-3 py-1 text-xs font-medium shadow"
        />

        {svgs.length > 0 && (
          <SidebarFooter className="group-data-[collapsible=icon]:hidden">
             {showChip && (
            <div
              aria-live="polite"
              className="text-muted-foreground flex h-6 items-center justify-between pl-2 text-xs group-data-[collapsible=icon]:hidden"
            >
              <span className="truncate">
                {selectedFolder
                  ? `Folder “${selectedFolder.name}” selected`
                  : `${selectedFileIds.size} selected${hiddenSelected > 0 ? ` (${hiddenSelected} hidden)` : ""}`}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Clear selection"
                onClick={onClearSelection}
              >
                <XIcon />
              </Button>
            </div>
          )}
            <Button
              variant="outline"
              className="text-muted-foreground justify-between"
              onClick={() => setManaging(true)}
            >
              Clear all stored files
              <ExternalLinkIcon />
            </Button>
          </SidebarFooter>
        )}
        <SidebarRail />

        {/* Manage all files: back up or remove everything stored locally */}
        <Dialog
          open={managing}
          onOpenChange={(open) => !open && !backingUp && setManaging(false)}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Manage all files</DialogTitle>
              <DialogDescription>
                {plural(svgs.length, "file")}
                {folders.length > 0 &&
                  ` in ${plural(folders.length, "folder")}`}{" "}
                stored in this browser. Download a backup ZIP of the originals,
                or remove everything. Removing can&apos;t be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="secondary"
                disabled={backingUp}
                onClick={() => void backupAll()}
              >
                <DownloadIcon />
                {backingUp ? "Preparing…" : "Download backup"}
              </Button>
              <Button
                className="bg-destructive/10 text-destructive hover:bg-destructive/20"
                disabled={backingUp}
                onClick={() => {
                  actions.clearAll();
                  setManaging(false);
                }}
              >
                <Trash2Icon />
                Remove all files
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Sidebar>
    </MenuContextProvider>
  );
}
