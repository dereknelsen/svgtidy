"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FolderArchiveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { ColorField } from "@/components/color-field";
import { downloadZip } from "@/lib/download";
import {
  buildFaviconPackage,
  DEFAULT_FAVICON_OPTIONS,
  FAVICON_FILE_LIST,
  type FaviconOptions,
} from "@/lib/favicon";
import { encodeCanvas, rasterize } from "@/lib/raster";
import { ensureSvgXmlns } from "@/lib/svg";
import { cn } from "@/lib/utils";

type FaviconDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The selected file's name and visual markup; null while nothing is selected. */
  source: { name: string; svg: string } | null;
};

/**
 * The favicon generator: one SVG → every standard favicon file, sized and
 * named the way browsers and platforms expect, plus the manifest,
 * browserconfig, and a paste-ready HTML snippet, zipped.
 */
export function FaviconDialog({
  open,
  onOpenChange,
  source,
}: FaviconDialogProps) {
  const [options, setOptions] = useState<FaviconOptions>(
    DEFAULT_FAVICON_OPTIONS,
  );
  const [building, setBuilding] = useState(false);
  const set = <K extends keyof FaviconOptions>(
    key: K,
    value: FaviconOptions[K],
  ) => setOptions((prev) => ({ ...prev, [key]: value }));

  const previews = useFaviconPreviews(
    open ? (source?.svg ?? null) : null,
    options,
  );

  const download = async () => {
    if (!source) return;
    setBuilding(true);
    try {
      const entries = await buildFaviconPackage(
        ensureSvgXmlns(source.svg),
        {
          ...options,
          name: options.name.trim() || stemOf(source.name),
        },
        async ({ size, background, padding }) => {
          const canvas = await rasterize(source.svg, {
            width: size,
            height: size,
            background,
            padding,
          });
          const blob = await encodeCanvas(canvas, "png");
          return new Uint8Array(await blob.arrayBuffer());
        },
      );
      await downloadZip(entries, `${stemOf(source.name)}-favicons.zip`);
      toast.success(`Downloading ${entries.length} favicon files as a ZIP`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't build favicons",
      );
    } finally {
      setBuilding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Generate favicons</DialogTitle>
          <DialogDescription>
            Every standard favicon file from this SVG, with the manifest,
            browserconfig, and a snippet of link tags to paste into your head.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-[1fr_13rem]">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="favicon-name">App name</Label>
                <Input
                  id="favicon-name"
                  placeholder={source ? stemOf(source.name) : "My app"}
                  value={options.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="favicon-short">Short name</Label>
                <Input
                  id="favicon-short"
                  placeholder="Home-screen label"
                  value={options.shortName ?? ""}
                  onChange={(e) => set("shortName", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ColorField
                label="Theme color"
                value={options.themeColor}
                onChange={(css) => set("themeColor", css)}
              />
              <ColorField
                label="Icon background"
                value={options.backgroundColor}
                onChange={(css) => set("backgroundColor", css)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label id="favicon-padding-label">Padding on solid icons</Label>
                <span className="text-muted-foreground font-mono text-xs">
                  {Math.round(options.padding * 100)}%
                </span>
              </div>
              <Slider
                aria-labelledby="favicon-padding-label"
                min={0}
                max={30}
                step={1}
                value={[Math.round(options.padding * 100)]}
                onValueChange={(value) => {
                  const next = Array.isArray(value) ? value[0] : value;
                  set("padding", next / 100);
                }}
              />
              <p className="text-muted-foreground text-xs">
                The iOS touch icon, Windows tile, and Android maskable icon get
                the background and padding. Tab icons stay edge to edge on
                transparency.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Label>Preview</Label>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-1">
              <PreviewTile
                label="Tab · 32px"
                url={previews.tab}
                className="rounded-md"
                size="size-8"
              />
              <PreviewTile
                label="iOS · 180px"
                url={previews.touch}
                className="rounded-[22%]"
                size="size-16"
              />
              <PreviewTile
                label="Android · maskable"
                url={previews.maskable}
                className="rounded-full"
                size="size-16"
              />
            </div>
          </div>
        </div>

        <details className="text-muted-foreground text-xs">
          <summary className="cursor-pointer select-none">
            {FAVICON_FILE_LIST.length} files in the ZIP
          </summary>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono sm:grid-cols-3">
            {FAVICON_FILE_LIST.map((file) => (
              <li key={file}>{file}</li>
            ))}
          </ul>
        </details>

        <DialogFooter>
          <Button
            onClick={() => void download()}
            disabled={!source || building}
          >
            {building ? <Spinner /> : <FolderArchiveIcon />}
            Download ZIP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewTile({
  label,
  url,
  className,
  size,
}: {
  label: string;
  url: string | null;
  className?: string;
  size: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="bg-checkerboard border-border flex h-24 w-full items-center justify-center rounded-xl border">
        {url ? (
          <img
            src={url}
            alt=""
            className={cn("shadow-sm", size, className)}
            style={{ imageRendering: "auto" }}
          />
        ) : (
          <Spinner className="text-muted-foreground size-4" />
        )}
      </div>
      <span className="text-muted-foreground text-[11px]">{label}</span>
    </div>
  );
}

function stemOf(name: string) {
  return name.replace(/\.svg$/i, "").trim() || "favicon";
}

type Previews = {
  tab: string | null;
  touch: string | null;
  maskable: string | null;
};

/** Debounced renders of the three icon shapes a user will actually see. */
function useFaviconPreviews(svg: string | null, options: FaviconOptions) {
  const [previews, setPreviews] = useState<Previews>({
    tab: null,
    touch: null,
    maskable: null,
  });
  const seq = useRef(0);
  const { backgroundColor, padding } = options;
  const deps = useMemo(
    () => ({ backgroundColor, padding }),
    [backgroundColor, padding],
  );

  useEffect(() => {
    const id = ++seq.current;
    if (!svg) return;
    const timer = window.setTimeout(async () => {
      const render = async (size: number, padded: boolean) => {
        const canvas = await rasterize(svg, {
          width: size,
          height: size,
          background: padded ? deps.backgroundColor : undefined,
          padding: padded ? deps.padding : 0,
        });
        return URL.createObjectURL(await encodeCanvas(canvas, "png"));
      };
      try {
        const [tab, touch, maskable] = await Promise.all([
          render(64, false),
          render(180, true),
          render(192, true),
        ]);
        if (id !== seq.current) {
          [tab, touch, maskable].forEach((u) => URL.revokeObjectURL(u));
          return;
        }
        setPreviews((prev) => {
          Object.values(prev).forEach((u) => u && URL.revokeObjectURL(u));
          return { tab, touch, maskable };
        });
      } catch {
        if (id === seq.current) {
          setPreviews({ tab: null, touch: null, maskable: null });
        }
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [svg, deps]);

  useEffect(
    () => () => {
      seq.current++;
      setPreviews((prev) => {
        Object.values(prev).forEach((u) => u && URL.revokeObjectURL(u));
        return prev;
      });
    },
    [],
  );

  return previews;
}
