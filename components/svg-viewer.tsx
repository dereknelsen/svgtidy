"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useDefaultLayout,
  type PanelImperativeHandle,
} from "react-resizable-panels";
import { copyText } from "@/lib/download";
import { formatBytes } from "@/lib/format";
import { useSvgObjectUrl } from "@/hooks/use-object-url";
import { CompareSlider } from "./compare-slider";
import { CodeView } from "./code-view";
import { DiffView } from "./diff-view";
import {
  PreviewStage,
  STAGE_HOME,
  nextZoomStop,
  useAltHeld,
  zoomTo,
  type StageTool,
  type StageView,
} from "./preview-stage";
import { useHotkey } from "@tanstack/react-hotkeys";
import { isTypingTarget } from "@/hooks/use-app-hotkeys";
import type { SvgDocType } from "@/lib/db";
import type { FormattedFile } from "@/lib/format-output";
import {
  optimizedOf,
  optimizedSizeOf,
  outputOf,
  type OptimizeResult,
} from "@/lib/optimize";
import {
  CheckIcon,
  CodeIcon,
  ColumnsIcon,
  CopyIcon,
  EyeIcon,
  GitCompareIcon,
  HandIcon,
  Maximize2Icon,
  MaximizeIcon,
  Minimize2Icon,
  MinusIcon,
  PlusIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { toast } from "sonner";

type TopMode = "preview" | "compare";
type BottomMode = "diff" | "code";

type SvgViewerProps = {
  svg: SvgDocType | null;
  result: OptimizeResult | undefined;
  /** The export projection (Format layer): what Copy/Download produce. */
  formatted: FormattedFile | null;
  /** The visual projection for the preview <img>, highlight included. */
  previewSvg: string | null;
};

const TOP_MODES: { value: TopMode; label: string; icon: typeof EyeIcon }[] = [
  { value: "preview", label: "Preview", icon: EyeIcon },
  { value: "compare", label: "Compare", icon: ColumnsIcon },
];

const BOTTOM_MODES: {
  value: BottomMode;
  label: string;
  icon: typeof EyeIcon;
}[] = [
  { value: "diff", label: "Diff", icon: GitCompareIcon },
  { value: "code", label: "Code", icon: CodeIcon },
];

/** Both split panels collapse to exactly this header bar. */
const HEADER_PX = 40;

/**
 * Shared header row: mode toggles on the left, controls on the right. When
 * the panel is hidden the whole bar becomes a click target to reopen it.
 */
function PanelHeader({
  left,
  right,
  onBarClick,
}: {
  left: ReactNode;
  right: ReactNode;
  onBarClick?: () => void;
}) {
  return (
    <div
      className={`border-border flex h-10 shrink-0 items-center justify-between gap-2 border-b px-2 ${onBarClick ? "cursor-pointer" : ""}`}
      onClick={onBarClick}
    >
      <div className="flex min-w-0 items-center gap-1">{left}</div>
      <div className="flex shrink-0 items-center gap-1">{right}</div>
    </div>
  );
}

/** Small copy-with-feedback button for the code panel's exact content. */
function CopyFormattedButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        const ok = await copyText(content);
        if (ok) setCopied(true);
        else toast.error("Couldn't copy to clipboard");
      }}
    >
      {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/** Persistent mouse tools for the stage: pan (H) and zoom (Z). */
function ToolToggles({
  tool,
  onToolChange,
}: {
  tool: StageTool | null;
  onToolChange: (tool: StageTool | null) => void;
}) {
  // With the zoom tool active, ⌥ inverts it, so mirror that in the icon.
  const zoomInverted = useAltHeld() && tool === "zoom";
  return (
    <ToggleGroup
      size="sm"
      value={tool ? [tool] : []}
      onValueChange={(value) => {
        const next = value[0] as StageTool | undefined;
        onToolChange(next ?? null);
      }}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <ToggleGroupItem value="pan" aria-label="Pan tool">
              <HandIcon />
            </ToggleGroupItem>
          }
        />
        <TooltipContent>Pan (H, or hold Space)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <ToggleGroupItem value="zoom" aria-label="Zoom tool">
              {zoomInverted ? <ZoomOutIcon /> : <ZoomInIcon />}
            </ToggleGroupItem>
          }
        />
        <TooltipContent>Zoom (Z) · click in, ⌥-click out</TooltipContent>
      </Tooltip>
    </ToggleGroup>
  );
}

/** [−] [100%] [+] [reset]: drives the preview stage's view. */
function ZoomControls({
  view,
  onViewChange,
}: {
  view: StageView;
  onViewChange: (view: StageView) => void;
}) {
  const [text, setText] = useState<string | null>(null);

  const commit = () => {
    if (text !== null) {
      const n = Number.parseFloat(text.replace("%", ""));
      if (Number.isFinite(n) && n > 0) onViewChange(zoomTo(view, n / 100));
    }
    setText(null);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom out"
              onClick={() =>
                onViewChange(zoomTo(view, nextZoomStop(view.zoom, -1)))
              }
            >
              <MinusIcon />
            </Button>
          }
        />
        <TooltipContent>Zoom out (⌘ scroll)</TooltipContent>
      </Tooltip>
      <Input
        aria-label="Zoom level"
        className="h-8 w-16 min-w-[8ch] text-center"
        value={text ?? `${Math.round(view.zoom * 100)}%`}
        onFocus={(e) => {
          setText(`${Math.round(view.zoom * 100)}`);
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setText(null);
        }}
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom in"
              onClick={() =>
                onViewChange(zoomTo(view, nextZoomStop(view.zoom, 1)))
              }
            >
              <PlusIcon />
            </Button>
          }
        />
        <TooltipContent>Zoom in (⌘ scroll)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Reset view"
              onClick={() => onViewChange(STAGE_HOME)}
            >
              <MaximizeIcon />
            </Button>
          }
        />
        <TooltipContent>Reset zoom &amp; pan</TooltipContent>
      </Tooltip>
    </>
  );
}

/**
 * The canvas: a persisted two-panel split with matching header bars. Top
 * shows the artwork (preview with zoom/pan, or compare); the bottom, shorter
 * panel holds the text views (diff or code). Each panel collapses to exactly
 * its header bar, so either can always be reopened.
 */
export function SvgViewer({
  svg,
  result,
  formatted,
  previewSvg,
}: SvgViewerProps) {
  const [topMode, setTopMode] = useState<TopMode>("preview");
  const [bottomMode, setBottomMode] = useState<BottomMode>("diff");
  const topRef = useRef<PanelImperativeHandle | null>(null);
  const bottomRef = useRef<PanelImperativeHandle | null>(null);
  const [topCollapsed, setTopCollapsed] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);

  // Persistent mouse tool for the preview stage; H / Z toggle, click to clear.
  const [tool, setTool] = useState<StageTool | null>(null);
  const previewVisible = topMode === "preview" && !topCollapsed;
  useHotkey("H", (event) => {
    if (previewVisible && !isTypingTarget(event.target)) {
      setTool((t) => (t === "pan" ? null : "pan"));
    }
  });
  useHotkey("Z", (event) => {
    if (previewVisible && !isTypingTarget(event.target)) {
      setTool((t) => (t === "zoom" ? null : "zoom"));
    }
  });

  // Zoom/pan, reset whenever the selected file changes (render-phase reset).
  const [view, setView] = useState<StageView>(STAGE_HOME);
  const [viewFor, setViewFor] = useState<string | undefined>(svg?.id);
  if (svg?.id !== viewFor) {
    setViewFor(svg?.id);
    setView(STAGE_HOME);
  }

  const layout = useDefaultLayout({
    id: "svgtidy:canvas-split",
    panelIds: ["canvas-top", "canvas-bottom"],
    onlySaveAfterUserInteractions: true,
  });

  // Stale-while-revalidate: while a re-optimize runs, keep showing the last
  // optimized output instead of snapping back to the original.
  const optimized = optimizedOf(result);
  const displayed = svg ? (previewSvg ?? outputOf(svg, result)) : null;

  const displayedUrl = useSvgObjectUrl(displayed);
  const originalUrl = useSvgObjectUrl(topMode === "compare" ? svg?.svg : null);

  if (!svg) {
    return (
      <div className="text-muted-foreground grid h-full place-items-center">
        <p className="text-sm">Select a file to preview.</p>
      </div>
    );
  }

  const pending = (
    <div className="grid h-full place-items-center">
      <p className="text-muted-foreground text-sm">
        Waiting for the first optimized result…
      </p>
    </div>
  );

  return (
    <ResizablePanelGroup
      orientation="vertical"
      defaultLayout={layout.defaultLayout}
      onLayoutChanged={layout.onLayoutChanged}
    >
      <ResizablePanel
        id="canvas-top"
        defaultSize="70"
        minSize="20"
        collapsible
        collapsedSize={HEADER_PX}
        panelRef={topRef}
        onResize={() => setTopCollapsed(topRef.current?.isCollapsed() ?? false)}
      >
        <div className="flex h-full flex-col">
          <PanelHeader
            left={
              <ToggleGroup
                size="sm"
                value={[topMode]}
                onValueChange={(value) => {
                  const next = value[0];
                  if (!next) return;
                  setTopMode(next as TopMode);
                  if (topRef.current?.isCollapsed()) topRef.current.expand();
                }}
              >
                {TOP_MODES.map(({ value, label, icon: Icon }) => (
                  <ToggleGroupItem key={value} value={value} aria-label={label}>
                    <Icon />
                    <span className="hidden sm:inline">{label}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            }
            right={
              previewVisible ? (
                <>
                  <ToolToggles tool={tool} onToolChange={setTool} />
                  <ZoomControls view={view} onViewChange={setView} />
                </>
              ) : null
            }
          />

          {!topCollapsed && (
            <div
              key={topMode}
              className="motion-safe:animate-in motion-safe:fade-in-0 relative min-h-0 flex-1 motion-safe:duration-150"
            >
              {topMode === "preview" && (
                <PreviewStage
                  url={displayedUrl}
                  alt={`Preview of ${svg.name}`}
                  view={view}
                  onViewChange={setView}
                  tool={tool}
                />
              )}

              {topMode === "compare" &&
                (optimized ? (
                  <CompareSlider
                    originalUrl={originalUrl}
                    optimizedUrl={displayedUrl}
                    originalLabel={formatBytes(svg.size)}
                    optimizedLabel={
                      optimizedSizeOf(result) != null
                        ? formatBytes(optimizedSizeOf(result)!)
                        : "…"
                    }
                    alt={svg.name}
                  />
                ) : (
                  pending
                ))}
            </div>
          )}
        </div>
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel
        id="canvas-bottom"
        defaultSize="30"
        minSize="15"
        collapsible
        collapsedSize={HEADER_PX}
        panelRef={bottomRef}
        onResize={() =>
          setBottomCollapsed(bottomRef.current?.isCollapsed() ?? false)
        }
      >
        <div className="flex h-full flex-col">
          <PanelHeader
            left={
              <ToggleGroup
                size="sm"
                value={[bottomMode]}
                onValueChange={(value) => {
                  const next = value[0];
                  if (!next) return;
                  setBottomMode(next as BottomMode);
                  if (bottomRef.current?.isCollapsed())
                    bottomRef.current.expand();
                }}
              >
                {BOTTOM_MODES.map(({ value, label, icon: Icon }) => (
                  <ToggleGroupItem key={value} value={value} aria-label={label}>
                    <Icon />
                    {label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            }
            right={
              <>
                {bottomMode === "code" && formatted && !bottomCollapsed && (
                  <CopyFormattedButton content={formatted.content} />
                )}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={
                          topCollapsed
                            ? "Restore the split"
                            : "Maximize code panel"
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          if (topCollapsed) {
                            topRef.current?.expand();
                          } else {
                            topRef.current?.collapse();
                            bottomRef.current?.expand();
                          }
                        }}
                      >
                        {topCollapsed ? <Minimize2Icon /> : <Maximize2Icon />}
                      </Button>
                    }
                  />
                  <TooltipContent>
                    {topCollapsed ? "Restore the split" : "Maximize"}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Hide code panel"
                        disabled={bottomCollapsed}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Hiding from a maximized state also restores the
                          // artwork, so it never strands two header bars.
                          bottomRef.current?.collapse();
                          if (topCollapsed) topRef.current?.expand();
                        }}
                      >
                        <XIcon />
                      </Button>
                    }
                  />
                  <TooltipContent>Hide code panel</TooltipContent>
                </Tooltip>
              </>
            }
            onBarClick={
              bottomCollapsed ? () => bottomRef.current?.expand() : undefined
            }
          />

          {!bottomCollapsed && (
            <div className="min-h-0 flex-1">
              {bottomMode === "diff" &&
                (optimized ? (
                  <DiffView original={svg.svg} optimized={optimized} />
                ) : (
                  pending
                ))}
              {bottomMode === "code" && (
                <CodeView
                  value={formatted?.content ?? optimized ?? svg.svg}
                  language={formatted?.language ?? "xml"}
                />
              )}
            </div>
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
