"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { toast } from "sonner";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  ChevronRightIcon,
  PanelLeftIcon,
  PanelRightIcon,
  RotateCcwIcon,
  ScaleIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Dropzone, useSvgDrop, type IncomingSvg } from "@/components/dropzone";
import { FilesSidebar } from "@/components/files-sidebar";
import { FileDialogs } from "@/components/file-dialogs";
import { FormatPanel } from "@/components/format-panel";
import { HeaderActions } from "@/components/header-actions";
import { ExportImageDialog } from "@/components/export-image-dialog";
import { FaviconDialog } from "@/components/favicon-dialog";
import { SeriesRenameDialog } from "@/components/series-rename-dialog";
import { SvgViewer } from "@/components/svg-viewer";
import { SettingsPanel } from "@/components/settings-panel";
import { PresetPicker } from "@/components/preset-picker";
import { StatCard } from "@/components/stat-card";
import { Wordmark } from "@/components/wordmark";
import {
  useDatabase,
  useSvgs,
  useFolders,
  usePresets,
  useSvgActions,
} from "@/hooks/use-svg-db";
import { useSettingsUrl } from "@/hooks/use-settings-url";
import { useFormatUrl } from "@/hooks/use-format-url";
import { useOptimize } from "@/hooks/use-optimize";
import { usePasteImport } from "@/hooks/use-paste-import";
import { useAppHotkeys } from "@/hooks/use-app-hotkeys";
import { useSelection } from "@/hooks/use-selection";
import { useSettingsScope, type Scope } from "@/hooks/use-settings-scope";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { downloadFile, downloadZip } from "@/lib/download";
import {
  buildSprite,
  formatCss,
  formatOutput,
  formatPreviewSvg,
  highlightPartSvg,
  type FormatContext,
} from "@/lib/format-output";
import { toDataUri } from "@/lib/export";
import { ensureSvgXmlns } from "@/lib/svg";
import { autoGroupName } from "@/lib/svg";
import { idPrefix } from "@/lib/settings";
import type { SvgDocType } from "@/lib/db";
import type {
  FileActions,
  MenuTarget,
  RenameTarget,
  SettingsTarget,
} from "@/lib/file-actions";
import {
  overrideCount,
  resolveAll,
  snapshotOverride,
  type Effective,
  type OverrideTarget,
} from "@/lib/effective-settings";
import { sharedFolderOf } from "@/lib/selection";
import { track, trackDebounced, umamiEvent } from "@/lib/analytics";
import { batchTotals, outputOf } from "@/lib/optimize";
import type { RasterFormat } from "@/lib/raster";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Label } from "../components/ui/label";

/**
 * The header lives inside the INNER (inspector) SidebarProvider, so anything
 * there that should drive the files sidebar can't call useSidebar directly,
 * because it would resolve to the wrong provider. This bridge captures the outer
 * context just below the outer provider and re-publishes it.
 */
const FilesSidebarContext = createContext<ReturnType<typeof useSidebar> | null>(
  null,
);

function CaptureFilesSidebar({ children }: { children: ReactNode }) {
  const ctx = useSidebar();
  return (
    <FilesSidebarContext.Provider value={ctx}>
      {children}
    </FilesSidebarContext.Provider>
  );
}

function FilesTrigger() {
  const ctx = useContext(FilesSidebarContext);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle files"
            className="-ml-1"
            onClick={() => ctx?.toggleSidebar()}
            {...umamiEvent("toggle-panel", { panel: "files" })}
          >
            <PanelLeftIcon />
          </Button>
        }
      />
      <TooltipContent>Toggle files ⌘B</TooltipContent>
    </Tooltip>
  );
}

/**
 * Sidebar shortcut bridges. Each must render INSIDE its SidebarProvider (and
 * outside the Sidebar itself: on mobile the sidebar body unmounts while
 * closed, which would unregister the very shortcut that opens it).
 */
function FilesSidebarHotkeys({
  filterRef,
}: {
  filterRef: RefObject<HTMLInputElement | null>;
}) {
  const { toggleSidebar, setOpen, setOpenMobile, isMobile } = useSidebar();
  useHotkey("Mod+B", () => toggleSidebar(), { preventDefault: true });
  useHotkey(
    "Mod+F",
    () => {
      if (isMobile) setOpenMobile(true);
      else setOpen(true);
      requestAnimationFrame(() => filterRef.current?.focus());
    },
    { preventDefault: true },
  );
  return null;
}

function InspectorHotkeys() {
  const { toggleSidebar } = useSidebar();
  useHotkey("Mod+I", () => toggleSidebar(), { preventDefault: true });
  return null;
}

/**
 * One collapsible inspector panel. The header sticks to the top of the
 * inspector's scroll area so the current section stays labeled while its
 * full-height content scrolls by.
 */
function InspectorSection({
  title,
  status,
  defaultOpen = false,
  actions,
  children,
}: {
  title: string;
  status?: string;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <div className="bg-sidebar border-border sticky top-0 z-10 flex items-center gap-1 border-b px-4 py-2">
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="group/section flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
            />
          }
        >
          <ChevronRightIcon className="text-muted-foreground size-4 shrink-0 transition-transform group-data-panel-open/section:rotate-90" />
          <span className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight">
              {title}
            </h2>
            {status && (
              <p className="text-muted-foreground truncate text-xs">{status}</p>
            )}
          </span>
        </CollapsibleTrigger>
        {actions}
      </div>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

/** The right-rail counterpart to SidebarTrigger (which is left-glyph only). */
function InspectorTrigger() {
  const { toggleSidebar } = useSidebar();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle inspector"
            onClick={toggleSidebar}
            {...umamiEvent("toggle-panel", { panel: "inspector" })}
          >
            <PanelRightIcon className="size-4" />
          </Button>
        }
      />
      <TooltipContent>Toggle inspector ⌘I</TooltipContent>
    </Tooltip>
  );
}

export default function Page() {
  const { db, ready } = useDatabase();
  const svgs = useSvgs(db);
  const folders = useFolders(db);
  const presets = usePresets(db);
  const {
    addSvgs,
    removeSvgs,
    moveSvgs,
    clearSvgs,
    duplicateSvgs,
    renameSvg,
    renameSvgs,
    setPartColors,
    patchOverride,
    clearOverride,
    replaceOverride,
    addFolder,
    renameFolder,
    removeFolder,
    duplicateFolder,
    savePreset,
    removePreset,
  } = useSvgActions(db);

  const { settings, setSetting, applyPreset, reset } = useSettingsUrl();
  const {
    format,
    setFormat,
    applyFormatPreset,
    reset: resetFormat,
  } = useFormatUrl();

  // The workspace base (URL) plus every folder and file override, resolved
  // once per change. Each file is optimized with its own effective settings.
  const base = useMemo<Effective>(
    () => ({ settings, format }),
    [settings, format],
  );
  const effective = useMemo(
    () => resolveAll(base, folders, svgs),
    [base, folders, svgs],
  );
  const effectiveOf = useCallback(
    (svg: { id: string }) => effective.files.get(svg.id) ?? base,
    [effective, base],
  );
  const jobs = useMemo(
    () =>
      svgs.map((svg) => ({
        id: svg.id,
        name: svg.name,
        svg: svg.svg,
        settings: effectiveOf(svg).settings,
      })),
    [svgs, effectiveOf],
  );
  const results = useOptimize(jobs);

  const {
    selection,
    anchor: selected,
    fileIds,
    selectedFiles,
    select,
    selectFolder,
    clearSelection,
    collapseToAnchor,
  } = useSelection(svgs, folders);
  const [rename, setRename] = useState<RenameTarget | null>(null);
  const [del, setDel] = useState<MenuTarget | null>(null);
  /** Copy/paste settings between files and folders (effective, both halves). */
  const [settingsClipboard, setSettingsClipboard] = useState<Effective | null>(
    null,
  );
  // The palette slot being hovered/edited in the Format panel, if any.
  const [highlightPart, setHighlightPart] = useState<string | null>(null);
  // Files currently in the series rename dialog; null = closed.
  const [seriesFiles, setSeriesFiles] = useState<SvgDocType[] | null>(null);
  const [exportFormat, setExportFormat] = useState<RasterFormat | null>(null);
  const [faviconOpen, setFaviconOpen] = useState(false);
  const filterRef = useRef<HTMLInputElement | null>(null);

  const handleAddFiles = useCallback(
    (
      files: IncomingSvg[],
      source: "hero" | "canvas-drop" | "paste" | "picker",
    ) => {
      track("add-files", { source, count: files.length });
      void (async () => {
        // Files that arrive together in one gesture become a folder.
        const folderId =
          files.length > 1
            ? await addFolder(autoGroupName(files.map((f) => f.name)))
            : undefined;
        await addSvgs(files, folderId);
      })();
      toast.success(
        files.length === 1
          ? `Added ${files[0].name}`
          : `Added ${files.length} SVGs`,
      );
    },
    [addSvgs, addFolder],
  );

  // Each entry point reports where the files came from.
  const addFromHero = useCallback(
    (files: IncomingSvg[]) => handleAddFiles(files, "hero"),
    [handleAddFiles],
  );
  const addFromCanvas = useCallback(
    (files: IncomingSvg[]) => handleAddFiles(files, "canvas-drop"),
    [handleAddFiles],
  );
  const addFromPaste = useCallback(
    (files: IncomingSvg[]) => handleAddFiles(files, "paste"),
    [handleAddFiles],
  );
  const addFromPicker = useCallback(
    (files: IncomingSvg[]) => handleAddFiles(files, "picker"),
    [handleAddFiles],
  );

  // Paste an SVG (file or markup) anywhere on the page to add it.
  usePasteImport(addFromPaste);

  // The canvas is always a dropzone. It accepts drag-and-drop only, with no
  // click or keyboard affordance.
  const {
    getRootProps: getCanvasDropProps,
    getInputProps: getCanvasDropInputProps,
    isDragActive: isCanvasDragActive,
  } = useSvgDrop(addFromCanvas);

  const handleRemovePreset = useCallback(
    (id: string) => void removePreset(id),
    [removePreset],
  );

  const selectedResult = selected ? results[selected.id] : undefined;
  const focusEffective = selected ? effectiveOf(selected) : base;
  const focusFormat = focusEffective.format;

  // Which layer the inspector edits. Defaults to the selection's natural
  // scope (folder → Folder, file → File) and resets when the selection
  // changes; the user can step up to the folder or the workspace.
  const scopeFolder = useMemo(() => {
    const id = selection.folderId ?? sharedFolderOf([...fileIds], svgs) ?? null;
    return id ? (folders.find((f) => f.id === id) ?? null) : null;
  }, [selection.folderId, fileIds, svgs, folders]);
  const naturalScope: Scope = selection.folderId
    ? "folder"
    : selected
      ? "file"
      : "workspace";
  const scopeKey = selection.folderId
    ? `folder:${selection.folderId}`
    : `files:${[...fileIds].join(",")}`;
  const [scopeChoice, setScopeChoice] = useState<{
    key: string;
    scope: Scope;
  } | null>(null);
  const availableScopes = useMemo<Scope[]>(
    () => [
      "workspace",
      ...(scopeFolder ? (["folder"] as const) : []),
      ...(!selection.folderId && selected ? (["file"] as const) : []),
    ],
    [scopeFolder, selection.folderId, selected],
  );
  const scope: Scope =
    scopeChoice?.key === scopeKey && availableScopes.includes(scopeChoice.scope)
      ? scopeChoice.scope
      : naturalScope;
  const urlBinding = useMemo(
    () => ({
      setSetting,
      setFormat,
      resetSettings: reset,
      resetFormat,
      applySettingsPreset: applyPreset,
      applyFormatPreset,
    }),
    [setSetting, setFormat, reset, resetFormat, applyPreset, applyFormatPreset],
  );
  const dbBinding = useMemo(
    () => ({ patchOverride, clearOverride, replaceOverride }),
    [patchOverride, clearOverride, replaceOverride],
  );
  const scoped = useSettingsScope({
    scope,
    base,
    effective,
    focusFile: selected,
    selectedFiles,
    folder: scopeFolder,
    url: urlBinding,
    db: dbBinding,
  });

  const totals = useMemo(() => batchTotals(svgs, results), [svgs, results]);

  const selectedOutput = selected ? outputOf(selected, selectedResult) : null;

  // The Format layer: everything below the optimizer is a pure projection of
  // (optimized output, format settings, per-file part colors).
  const formatCtx = useMemo<FormatContext | null>(
    () =>
      selected
        ? { name: selected.name, partColors: selected.partColors }
        : null,
    [selected],
  );

  /** The svg-type visual markup. Feeds preview, compare, data URI, and CSS. */
  const visualSvg = useMemo(
    () =>
      selectedOutput && formatCtx
        ? formatPreviewSvg(selectedOutput, focusFormat, formatCtx)
        : null,
    [selectedOutput, focusFormat, formatCtx],
  );

  // While a part slot is hovered/edited, dim every OTHER slot. The dim pass
  // runs before recoloring so override lookups still match original paints.
  const previewSvg = useMemo(() => {
    if (!selectedOutput || !formatCtx) return null;
    if (!highlightPart) return visualSvg;
    return formatPreviewSvg(
      highlightPartSvg(selectedOutput, highlightPart),
      focusFormat,
      formatCtx,
    );
  }, [selectedOutput, formatCtx, focusFormat, highlightPart, visualSvg]);

  // The header menu's quick copies: the bare data URI and the CSS snippet,
  // both honoring the CSS settings even while another file type is selected.
  const dataUri = useMemo(
    () =>
      visualSvg
        ? toDataUri(ensureSvgXmlns(visualSvg), {
            encoding: focusFormat.cssEncoding,
            quotes: focusFormat.cssQuotes,
          })
        : null,
    [visualSvg, focusFormat.cssEncoding, focusFormat.cssQuotes],
  );
  const css = useMemo(
    () =>
      visualSvg && formatCtx
        ? formatCss(visualSvg, focusFormat, formatCtx)
        : null,
    [visualSvg, focusFormat, formatCtx],
  );

  /** The export projection: what Copy, Download, and the Code view produce. */
  const formatted = useMemo(
    () =>
      selectedOutput && formatCtx
        ? formatOutput(selectedOutput, focusFormat, formatCtx)
        : null,
    [selectedOutput, focusFormat, formatCtx],
  );

  /** A file's export projection under its own effective format settings. */
  const formatFile = useCallback(
    (svg: SvgDocType) =>
      formatOutput(outputOf(svg, results[svg.id]), effectiveOf(svg).format, {
        name: svg.name,
        partColors: svg.partColors,
      }),
    [results, effectiveOf],
  );

  const handleDownloadZip = useCallback(async () => {
    const files = svgs.map((svg) => {
      const out = formatFile(svg);
      return { filename: out.filename, content: out.content };
    });
    if (files.length === 0) return;
    track("download-zip", { scope: "all", count: files.length });
    try {
      await downloadZip(files);
      toast.success(`Downloading ${files.length} files as a ZIP`);
    } catch {
      toast.error("Couldn't build the ZIP");
    }
  }, [svgs, formatFile]);

  const handleDownloadSprite = useCallback(() => {
    if (svgs.length === 0) return;
    const sprite = buildSprite(
      svgs.map((svg) => ({
        symbolId: idPrefix(svg.name),
        svg: formatPreviewSvg(
          outputOf(svg, results[svg.id]),
          effectiveOf(svg).format,
          { name: svg.name, partColors: svg.partColors },
        ),
      })),
    );
    downloadFile("sprite.svg", sprite, "image/svg+xml");
    track("download-sprite", { count: svgs.length });
  }, [svgs, results, effectiveOf]);

  // Raster export renders the same visual projection the preview shows.
  const rasterCurrent = useMemo(
    () =>
      selected && visualSvg ? { name: selected.name, svg: visualSvg } : null,
    [selected, visualSvg],
  );
  const rasterAll = useMemo(
    () =>
      svgs.map((svg) => ({
        name: svg.name,
        svg: formatPreviewSvg(
          outputOf(svg, results[svg.id]),
          effectiveOf(svg).format,
          { name: svg.name, partColors: svg.partColors },
        ),
      })),
    [svgs, results, effectiveOf],
  );

  // Series rename scope: a folder's files, or a single loose file.
  const openSeriesRename = useCallback(
    (folderId: string | null, fallback?: SvgDocType) => {
      const files = folderId
        ? svgs.filter((s) => s.folderId === folderId)
        : fallback
          ? [fallback]
          : [];
      if (files.length > 0) setSeriesFiles(files);
    },
    [svgs],
  );

  const toOverrideTargets = (target: SettingsTarget): OverrideTarget[] =>
    target.kind === "folder"
      ? [{ kind: "folder", id: target.id }]
      : target.ids.map((id) => ({ kind: "file", id }));

  // Everything the files sidebar can do to files and folders.
  const fileActions = useMemo<FileActions>(
    () => ({
      removeSvgs: (ids) => {
        track("remove-files", { count: ids.length });
        const name =
          ids.length === 1 ? svgs.find((s) => s.id === ids[0])?.name : null;
        void removeSvgs(ids);
        toast.success(name ? `Removed ${name}` : `Removed ${ids.length} files`);
      },
      duplicateSvgs: (ids) => {
        track("duplicate-files", { count: ids.length });
        void duplicateSvgs(ids);
      },
      downloadSvgs: (ids) => {
        const files = svgs.filter((s) => ids.includes(s.id));
        if (files.length === 0) return;
        if (files.length === 1) {
          track("download-file", {
            type: effectiveOf(files[0]).format.fileType,
            via: "sidebar",
          });
          const out = formatFile(files[0]);
          downloadFile(out.filename, out.content, out.mime);
          return;
        }
        const shared = sharedFolderOf(ids, svgs);
        const zipName = shared
          ? `${folders.find((f) => f.id === shared)?.name ?? "svgtidy"}.zip`
          : "svgtidy.zip";
        track("download-zip", { scope: "selection", count: files.length });
        downloadZip(
          files.map((svg) => {
            const out = formatFile(svg);
            return { filename: out.filename, content: out.content };
          }),
          zipName,
        )
          .then(() =>
            toast.success(`Downloading ${files.length} files as a ZIP`),
          )
          .catch(() => toast.error("Couldn't build the ZIP"));
      },
      renameSvg: (id, name) => {
        track("rename-file");
        void renameSvg(id, name);
      },
      seriesRenameFiles: (ids) => {
        const files = svgs.filter((s) => ids.includes(s.id));
        if (files.length === 0) return;
        track("series-rename-open", {
          scope: "selection",
          count: files.length,
        });
        setSeriesFiles(files);
      },
      moveSvgs: (ids, folderId) => {
        track("move-files", {
          count: ids.length,
          to: folderId ? "folder" : "loose",
        });
        void moveSvgs(ids, folderId);
        const target = folderId
          ? folders.find((f) => f.id === folderId)?.name
          : null;
        const what = ids.length === 1 ? "1 file" : `${ids.length} files`;
        toast.success(
          target
            ? `Moved ${what} into “${target}”`
            : `Moved ${what} out of folder`,
        );
      },
      newFolderFromSelection: (ids) =>
        void (async () => {
          track("new-folder", { from: "selection", count: ids.length });
          const names = svgs
            .filter((s) => ids.includes(s.id))
            .map((s) => s.name);
          const folderId = await addFolder(autoGroupName(names));
          if (!folderId) return;
          await moveSvgs(ids, folderId);
          selectFolder(folderId);
          setRename({ kind: "folder", id: folderId });
        })(),
      newFolder: () =>
        void (async () => {
          track("new-folder", { from: "empty" });
          const folderId = await addFolder("Untitled folder");
          if (!folderId) return;
          selectFolder(folderId);
          setRename({ kind: "folder", id: folderId });
        })(),
      renameFolder: (id, name) => {
        track("rename-folder");
        void renameFolder(id, name);
      },
      removeFolder: (id) => {
        track("remove-folder", {
          count: svgs.filter((s) => s.folderId === id).length,
        });
        const name = folders.find((f) => f.id === id)?.name;
        void removeFolder(id);
        if (name) toast.success(`Deleted “${name}”`);
      },
      duplicateFolder: (id) => {
        track("duplicate-folder");
        void duplicateFolder(id);
      },
      downloadFolder: (id) => {
        const folder = folders.find((f) => f.id === id);
        const files = svgs
          .filter((s) => s.folderId === id)
          .map((svg) => {
            const out = formatFile(svg);
            return { filename: out.filename, content: out.content };
          });
        if (files.length === 0) return;
        track("download-zip", { scope: "folder", count: files.length });
        void downloadZip(files, `${folder?.name ?? "svgtidy"}.zip`);
      },
      seriesRename: (folderId) => {
        track("series-rename-open", { scope: "folder" });
        openSeriesRename(folderId);
      },
      copySettings: (target) => {
        track("copy-settings", { kind: target.kind });
        const source =
          target.kind === "folder"
            ? effective.folders.get(target.id)
            : effective.files.get(target.ids[0]);
        if (!source) return;
        setSettingsClipboard(source);
        toast.success("Settings copied", {
          description: "Paste them onto any file or folder.",
        });
      },
      pasteSettings: (target) => {
        if (!settingsClipboard) return;
        track("paste-settings", {
          kind: target.kind,
          count: target.kind === "files" ? target.ids.length : 1,
        });
        void replaceOverride(
          toOverrideTargets(target),
          snapshotOverride(settingsClipboard),
        );
        toast.success("Settings pasted");
      },
      clearOverrides: (target) => {
        track("clear-overrides", { kind: target.kind });
        void clearOverride(toOverrideTargets(target));
        toast.success("Overrides cleared");
      },
      canPasteSettings: settingsClipboard !== null,
      hasOverrides: (target) =>
        target.kind === "folder"
          ? overrideCount(folders.find((f) => f.id === target.id)?.override) > 0
          : target.ids.some(
              (id) =>
                overrideCount(svgs.find((s) => s.id === id)?.override) > 0,
            ),
      backupAll: async () => {
        // Back up the stored sources, not the formatted output, so the ZIP
        // round-trips: re-adding it restores the files exactly as they were.
        const folderName = new Map(folders.map((f) => [f.id, f.name]));
        const files = svgs.map((svg) => {
          const name = svg.name.toLowerCase().endsWith(".svg")
            ? svg.name
            : `${svg.name}.svg`;
          const dir = svg.folderId ? folderName.get(svg.folderId) : undefined;
          return { filename: dir ? `${dir}/${name}` : name, content: svg.svg };
        });
        if (files.length === 0) return;
        track("backup-all", { count: files.length });
        try {
          await downloadZip(files, "svgtidy-backup.zip");
          toast.success(
            `Downloading ${files.length} ${files.length === 1 ? "file" : "files"} as a backup ZIP`,
          );
        } catch {
          toast.error("Couldn't build the backup ZIP");
        }
      },
      clearAll: () => {
        const count = svgs.length;
        track("clear-all", { count });
        void clearSvgs();
        toast.success(`Removed ${count} ${count === 1 ? "file" : "files"}`);
      },
    }),
    [
      svgs,
      folders,
      effective,
      settingsClipboard,
      formatFile,
      effectiveOf,
      removeSvgs,
      duplicateSvgs,
      moveSvgs,
      renameSvg,
      openSeriesRename,
      addFolder,
      selectFolder,
      renameFolder,
      removeFolder,
      duplicateFolder,
      replaceOverride,
      clearOverride,
      clearSvgs,
    ],
  );

  /** What the hotkeys and header act on: the folder, else the selected files. */
  const actionTarget = useMemo<MenuTarget | null>(
    () =>
      selection.folderId
        ? { kind: "folder", id: selection.folderId }
        : fileIds.size > 0
          ? { kind: "files", ids: [...fileIds] }
          : null,
    [selection.folderId, fileIds],
  );

  const hasFiles = svgs.length > 0;
  const workspace = ready && hasFiles;

  // Selection-scoped shortcuts, acting on the folder or every selected file.
  const t = actionTarget;
  useAppHotkeys(workspace && !!t, {
    onDuplicate: () => {
      if (t?.kind === "folder") fileActions.duplicateFolder(t.id);
      else if (t?.kind === "files") fileActions.duplicateSvgs(t.ids);
    },
    onDownload: () => {
      if (t?.kind === "folder") fileActions.downloadFolder(t.id);
      else if (t?.kind === "files") fileActions.downloadSvgs(t.ids);
    },
    onDelete: () => {
      if (!t || t.kind === "empty") return;
      if (t.kind === "folder" || t.ids.length > 1) setDel(t);
      else fileActions.removeSvgs(t.ids);
    },
    onRename: () => {
      if (t?.kind === "folder") fileActions.seriesRename(t.id);
      else if (t?.kind === "files" && t.ids.length > 1)
        fileActions.seriesRenameFiles(t.ids);
      else if (selected) openSeriesRename(selected.folderId ?? null, selected);
    },
    onNewFolderFromSelection: () => {
      if (t?.kind === "files") fileActions.newFolderFromSelection(t.ids);
    },
    onEscape: collapseToAnchor,
    canGroup: t?.kind === "files",
    canEscape: fileIds.size > 1 || selection.folderId !== null,
  });

  // A folder or multi-selection reads as an aggregate at the top.
  const statGroup = useMemo(() => {
    const files =
      selection.folderId && scopeFolder
        ? svgs.filter((s) => s.folderId === scopeFolder.id)
        : fileIds.size > 1
          ? selectedFiles
          : null;
    if (!files) return null;
    const label =
      selection.folderId && scopeFolder
        ? scopeFolder.name
        : `${files.length} files selected`;
    return { label, count: files.length, totals: batchTotals(files, results) };
  }, [
    selection.folderId,
    scopeFolder,
    svgs,
    fileIds.size,
    selectedFiles,
    results,
  ]);

  const scopeLabels: Record<Scope, string> = {
    workspace: "Workspace",
    folder: "Folder",
    file: fileIds.size > 1 ? `${fileIds.size} files` : "File",
  };

  const inspector = (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3">
        <StatCard
          svg={selected}
          result={selectedResult}
          batch={{ total: svgs.length, done: totals.done }}
          group={statGroup}
        />
        {availableScopes.length > 1 && (
          <div className="flex flex-col gap-2.5">
            <Label className="">Settings scope</Label>
            <p className="text-muted-foreground text-xs">Adjust the settings for the entire workspace, selected folders, or selected files.</p>
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={0}
              className="w-full"
              aria-label="Settings scope"
              value={[scope]}
              onValueChange={(value) => {
                const next = value[0] as Scope | undefined;
                if (!next) return;
                track("scope-change", { scope: next });
                setScopeChoice({ key: scopeKey, scope: next });
              }}
            >
              {availableScopes.map((s) => (
                <ToggleGroupItem key={s} value={s} className="flex-auto">
                  {scopeLabels[s]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}
        <PresetPicker
          settings={scoped.settings}
          format={scoped.format}
          onApply={scoped.applyPreset}
          savedPresets={presets}
          onSave={savePreset}
          onRemove={handleRemovePreset}
          shareHint={
            scope === "workspace"
              ? "Copy share link"
              : "Copy share link (workspace settings)"
          }
        />
      </div>
      <InspectorSection
        title="Format"
        status={scoped.status.format}
        actions={
          <Button
            variant="ghost"
            size="xs"
            onClick={scoped.resetFormat}
            disabled={!scoped.canResetFormat}
            aria-label="Reset format settings"
          >
            <RotateCcwIcon />
            Reset
          </Button>
        }
      >
        <FormatPanel
          svg={selected}
          optimizedSvg={selectedOutput}
          format={scoped.format}
          onFormatChange={scoped.onFormat}
          marked={scoped.marked}
          onClear={scoped.onClear}
          onRename={(id, name) => fileActions.renameSvg(id, name)}
          onSeriesRename={
            selected
              ? () => openSeriesRename(selected.folderId ?? null, selected)
              : null
          }
          onPartColorsChange={(id, partColors) => {
            trackDebounced("part-color", "part-color-change", {
              parts: Object.keys(partColors).length,
            });
            void setPartColors(id, partColors);
          }}
          onPartHover={setHighlightPart}
        />
      </InspectorSection>
      <InspectorSection
        title="Optimizations"
        defaultOpen
        status={scoped.status.settings}
        actions={
          <Button
            variant="ghost"
            size="xs"
            onClick={scoped.resetSettings}
            disabled={!scoped.canResetSettings}
            aria-label="Reset optimization settings"
          >
            <RotateCcwIcon />
            Reset
          </Button>
        }
      >
        <SettingsPanel
          settings={scoped.settings}
          onChange={scoped.onSetting}
          marked={scoped.marked}
          onClear={scoped.onClear}
        />
      </InspectorSection>
    </div>
  );

  return (
    <TooltipProvider delay={300}>
      <SidebarProvider className="h-dvh min-h-0 overflow-hidden">
        <CaptureFilesSidebar>
          {workspace && (
            <>
              <FilesSidebarHotkeys filterRef={filterRef} />
              <FilesSidebar
                svgs={svgs}
                folders={folders}
                results={results}
                selection={selection}
                selectedFileIds={fileIds}
                onSelect={select}
                onSelectFolder={selectFolder}
                onClearSelection={clearSelection}
                actions={fileActions}
                onAddFiles={addFromPicker}
                onRenameRequest={setRename}
                onDeleteRequest={setDel}
                filterRef={filterRef}
              />
            </>
          )}
          <SidebarInset className="min-w-0">
            <SidebarProvider className="min-h-0 flex-1">
              {workspace && <InspectorHotkeys />}
              <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
                <header className="border-border bg-sidebar flex h-14 shrink-0 items-center justify-between border-b px-4">
                  <div className="flex items-center gap-2">
                    {workspace && <FilesTrigger />}
                    <Link
                      href="/"
                      className="flex items-center transition-opacity hover:opacity-60"
                    >
                      <Wordmark className="h-10" />
                    </Link>
                  </div>

                  {workspace && (
                    <HeaderActions
                      formatted={formatted}
                      dataUri={dataUri}
                      css={css}
                      fileType={focusFormat.fileType}
                      fileCount={svgs.length}
                      onDownloadZip={() => void handleDownloadZip()}
                      onDownloadSprite={handleDownloadSprite}
                      onExportImage={(format) => {
                        track("open-export-image", { format });
                        setExportFormat(format);
                      }}
                      onGenerateFavicons={() => {
                        track("open-favicons");
                        setFaviconOpen(true);
                      }}
                    />
                  )}

                  <div className="flex items-center gap-1">
                    <a
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon-sm" }),
                      )}
                      href="https://github.com/dereknelsen/svgtidy"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <GitHubIcon className="size-4" />
                    </a>
                    <HoverCard>
                      <HoverCardTrigger>
                        <div
                          className={cn(
                            buttonVariants({
                              variant: "ghost",
                              size: "icon-sm",
                            }),
                          )}
                        >
                          <ScaleIcon className="size-4" />
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent className="flex w-64 flex-col gap-3 text-xs z-50">
                        <p>
                          SVGtidy is an open-source project available for free
                          under the{" "}
                          <a
                            href="https://github.com/dereknelsen/svgtidy/blob/main/LICENSE"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary underline"
                          >
                            MIT license
                          </a>{" "}
                          and was heavily inspired by{" "}
                          <a
                            href="https://github.com/jakearchibald/svgomg"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary underline"
                          >
                            Jake Archibald&apos;s SVGOMG
                          </a>
                          . Many thanks for the original!
                        </p>
                      </HoverCardContent>
                    </HoverCard>
                    <ThemeToggle />
                    {workspace && <InspectorTrigger />}
                  </div>
                </header>

                {!ready ? (
                  <div className="grid flex-1 place-items-center">
                    {/* Delayed fade-in so fast loads never flash the loader. */}
                    <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:fill-mode-forwards flex flex-col items-center gap-3 opacity-0 motion-safe:delay-150 motion-safe:duration-300">
                      <Wordmark className="animate-pulse text-lg" />
                      <p className="text-muted-foreground text-sm">
                        Loading your files…
                      </p>
                    </div>
                  </div>
                ) : !hasFiles ? (
                  <div className="motion-safe:animate-in motion-safe:fade-in-0 flex flex-1 items-center justify-center overflow-auto p-6 motion-safe:duration-200">
                    <div className="w-full max-w-lg">
                      <Dropzone onFiles={addFromHero} />
                      <p className="text-muted-foreground mt-4 text-center text-xs text-balance">
                        Files and presets stay on this device. Close the tab and
                        your work is still here when you come back.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    {...getCanvasDropProps({
                      className:
                        "motion-safe:animate-in motion-safe:fade-in-0 relative min-h-0 min-w-0 flex-1 motion-safe:duration-300",
                    })}
                  >
                    <input {...getCanvasDropInputProps()} />
                    <SvgViewer
                      svg={selected}
                      result={selectedResult}
                      formatted={formatted}
                      previewSvg={previewSvg}
                    />
                    {isCanvasDragActive && (
                      <div className="border-success bg-success/5 pointer-events-none absolute inset-3 z-30 grid place-items-center rounded-2xl border-2 border-dashed">
                        <p className="bg-background/85 text-success rounded-full px-4 py-2 text-sm font-medium shadow-sm backdrop-blur">
                          Drop SVGs to add
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </SidebarInset>

              {workspace && (
                <Sidebar side="right" collapsible="offcanvas">
                  <SidebarContent className="gap-0">{inspector}</SidebarContent>
                </Sidebar>
              )}
            </SidebarProvider>
          </SidebarInset>
        </CaptureFilesSidebar>
      </SidebarProvider>

      <FileDialogs
        svgs={svgs}
        folders={folders}
        actions={fileActions}
        rename={rename}
        onRenameClose={() => setRename(null)}
        del={del}
        onDeleteClose={() => setDel(null)}
      />
      <SeriesRenameDialog
        files={seriesFiles}
        onOpenChange={(open) => !open && setSeriesFiles(null)}
        onRename={(updates) => {
          track("series-rename-commit", { count: updates.length });
          void renameSvgs(updates);
        }}
      />
      <ExportImageDialog
        format={exportFormat}
        onOpenChange={(open) => !open && setExportFormat(null)}
        current={rasterCurrent}
        all={rasterAll}
      />
      <FaviconDialog
        open={faviconOpen}
        onOpenChange={setFaviconOpen}
        source={rasterCurrent}
      />
    </TooltipProvider>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={cn(className)} viewBox="0 0 438.549 438.549">
      <path
        fill="currentColor"
        d="M409.132 114.573c-19.608-33.596-46.205-60.194-79.798-79.8-33.598-19.607-70.277-29.408-110.063-29.408-39.781 0-76.472 9.804-110.063 29.408-33.596 19.605-60.192 46.204-79.8 79.8C9.803 148.168 0 184.854 0 224.63c0 47.78 13.94 90.745 41.827 128.906 27.884 38.164 63.906 64.572 108.063 79.227 5.14.954 8.945.283 11.419-1.996 2.475-2.282 3.711-5.14 3.711-8.562 0-.571-.049-5.708-.144-15.417a2549.81 2549.81 0 01-.144-25.406l-6.567 1.136c-4.187.767-9.469 1.092-15.846 1-6.374-.089-12.991-.757-19.842-1.999-6.854-1.231-13.229-4.086-19.13-8.559-5.898-4.473-10.085-10.328-12.56-17.556l-2.855-6.57c-1.903-4.374-4.899-9.233-8.992-14.559-4.093-5.331-8.232-8.945-12.419-10.848l-1.999-1.431c-1.332-.951-2.568-2.098-3.711-3.429-1.142-1.331-1.997-2.663-2.568-3.997-.572-1.335-.098-2.43 1.427-3.289 1.525-.859 4.281-1.276 8.28-1.276l5.708.853c3.807.763 8.516 3.042 14.133 6.851 5.614 3.806 10.229 8.754 13.846 14.842 4.38 7.806 9.657 13.754 15.846 17.847 6.184 4.093 12.419 6.136 18.699 6.136 6.28 0 11.704-.476 16.274-1.423 4.565-.952 8.848-2.383 12.847-4.285 1.713-12.758 6.377-22.559 13.988-29.41-10.848-1.14-20.601-2.857-29.264-5.14-8.658-2.286-17.605-5.996-26.835-11.14-9.235-5.137-16.896-11.516-22.985-19.126-6.09-7.614-11.088-17.61-14.987-29.979-3.901-12.374-5.852-26.648-5.852-42.826 0-23.035 7.52-42.637 22.557-58.817-7.044-17.318-6.379-36.732 1.997-58.24 5.52-1.715 13.706-.428 24.554 3.853 10.85 4.283 18.794 7.952 23.84 10.994 5.046 3.041 9.089 5.618 12.135 7.708 17.705-4.947 35.976-7.421 54.818-7.421s37.117 2.474 54.823 7.421l10.849-6.849c7.419-4.57 16.18-8.758 26.262-12.565 10.088-3.805 17.802-4.853 23.134-3.138 8.562 21.509 9.325 40.922 2.279 58.24 15.036 16.18 22.559 35.787 22.559 58.817 0 16.178-1.958 30.497-5.853 42.966-3.9 12.471-8.941 22.457-15.125 29.979-6.191 7.521-13.901 13.85-23.131 18.986-9.232 5.14-18.182 8.85-26.84 11.136-8.662 2.286-18.415 4.004-29.263 5.146 9.894 8.562 14.842 22.077 14.842 40.539v60.237c0 3.422 1.19 6.279 3.572 8.562 2.379 2.279 6.136 2.95 11.276 1.995 44.163-14.653 80.185-41.062 108.068-79.226 27.88-38.161 41.825-81.126 41.825-128.906-.01-39.771-9.818-76.454-29.414-110.049z"
      ></path>
    </svg>
  );
}
