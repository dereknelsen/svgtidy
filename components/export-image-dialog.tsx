"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DownloadIcon, FolderArchiveIcon } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ColorField } from "@/components/color-field";
import { downloadBlob, downloadZip } from "@/lib/download";
import { formatBytes } from "@/lib/format";
import {
  DEFAULT_QUALITY,
  naturalSize,
  rasterFilename,
  renderRaster,
  RASTER_FORMATS,
  type RasterFormat,
} from "@/lib/raster";
import { cn } from "@/lib/utils";

/** One file to export: its display name and the visual markup to render. */
export type RasterSource = { name: string; svg: string };

type ExportImageDialogProps = {
  /** The format the dialog opens on; null keeps the dialog closed. */
  format: RasterFormat | null;
  onOpenChange: (open: boolean) => void;
  /** The selected file; null while nothing is selected. */
  current: RasterSource | null;
  /** Every file, for the batch ZIP. */
  all: RasterSource[];
};

const SCALES = [1, 2, 3, 4] as const;
const MAX_SIDE = 8192;

/**
 * Raster export for the selected file (or all files as a ZIP): PNG, WebP, or
 * AVIF at a chosen scale or exact width, with an optional background. The
 * preview is the real encoded result so the size readout is what ships.
 */
export function ExportImageDialog({
  format: initialFormat,
  onOpenChange,
  current,
  all,
}: ExportImageDialogProps) {
  const open = initialFormat !== null;
  const [format, setFormat] = useState<RasterFormat>("png");
  const [scale, setScale] = useState<number>(1);
  const [widthText, setWidthText] = useState<string | null>(null);
  const [quality, setQuality] = useState(DEFAULT_QUALITY);
  const [opaque, setOpaque] = useState(false);
  const [background, setBackground] = useState("#ffffff");

  // Reopening on a menu entry re-selects that entry's format.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialFormat) setFormat(initialFormat);
  }, [initialFormat]);

  const meta = RASTER_FORMATS.find((f) => f.value === format)!;
  const natural = useMemo(
    () => (current ? naturalSize(current.svg) : { width: 0, height: 0 }),
    [current],
  );
  const aspect = natural.height > 0 ? natural.height / natural.width : 1;

  // Width is either the scale × natural width, or whatever was typed.
  const typedWidth = widthText === null ? NaN : Number.parseInt(widthText, 10);
  const width = clampSide(
    Number.isFinite(typedWidth) && typedWidth > 0
      ? typedWidth
      : Math.round(natural.width * scale),
  );
  const height = clampSide(Math.round(width * aspect));
  const options = useMemo(
    () => ({
      format,
      width,
      height,
      quality,
      background: opaque ? background : undefined,
    }),
    [format, width, height, quality, opaque, background],
  );

  const preview = usePreview(open ? current : null, options);

  const download = async () => {
    if (!current) return;
    try {
      const blob = preview.blob ?? (await renderRaster(current.svg, options));
      downloadBlob(blob, rasterFilename(current.name, format));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  };

  const [zipping, setZipping] = useState(false);
  const downloadAll = async () => {
    if (all.length === 0) return;
    setZipping(true);
    try {
      const files = await Promise.all(
        all.map(async (file) => {
          // Each file keeps its own aspect at the chosen width.
          const own = naturalSize(file.svg);
          const w =
            widthText === null
              ? clampSide(Math.round(own.width * scale))
              : width;
          const h = clampSide(Math.round((w * own.height) / own.width));
          const blob = await renderRaster(file.svg, {
            ...options,
            width: w,
            height: h,
          });
          return {
            filename: rasterFilename(file.name, format),
            content: new Uint8Array(await blob.arrayBuffer()),
          };
        }),
      );
      await downloadZip(files, `svgtidy-${meta.ext}.zip`);
      toast.success(`Downloading ${files.length} ${meta.label} files as a ZIP`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setZipping(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export as image</DialogTitle>
          <DialogDescription>
            Rasterize the formatted SVG. Colors and size follow the Format
            panel; the file type does not.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-[1fr_12rem]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Format</Label>
              <ToggleGroup
                variant="outline"
                size="sm"
                spacing={0}
                className="w-full"
                aria-label="Image format"
                value={[format]}
                onValueChange={(value) => {
                  const next = value[0] as RasterFormat | undefined;
                  if (next) setFormat(next);
                }}
              >
                {RASTER_FORMATS.map((f) => (
                  <ToggleGroupItem
                    key={f.value}
                    value={f.value}
                    className="flex-1"
                  >
                    {f.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="text-muted-foreground text-xs">{meta.hint}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="export-width">Size</Label>
              <div className="flex items-center gap-2">
                <ToggleGroup
                  variant="outline"
                  size="sm"
                  spacing={0}
                  aria-label="Scale"
                  value={widthText === null ? [String(scale)] : []}
                  onValueChange={(value) => {
                    const next = Number(value[0]);
                    if (next) {
                      setScale(next);
                      setWidthText(null);
                    }
                  }}
                >
                  {SCALES.map((s) => (
                    <ToggleGroupItem
                      key={s}
                      value={String(s)}
                      className="px-2.5"
                    >
                      {s}×
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <Input
                  id="export-width"
                  inputMode="numeric"
                  className="w-24 font-mono"
                  value={widthText ?? String(width)}
                  onChange={(e) =>
                    setWidthText(e.target.value.replace(/[^\d]/g, ""))
                  }
                  onBlur={() => {
                    if (widthText === "") setWidthText(null);
                  }}
                  aria-label="Width in pixels"
                />
                <span className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                  × {height} px
                </span>
              </div>
            </div>

            {meta.lossy && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label id="export-quality-label">Quality</Label>
                  <span className="text-muted-foreground font-mono text-xs">
                    {quality}
                  </span>
                </div>
                <Slider
                  aria-labelledby="export-quality-label"
                  min={1}
                  max={100}
                  step={1}
                  value={[quality]}
                  onValueChange={(value) => {
                    const next = Array.isArray(value) ? value[0] : value;
                    setQuality(next);
                  }}
                />
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="export-opaque">Background</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    {opaque ? "Solid" : "Transparent"}
                  </span>
                  <Switch
                    id="export-opaque"
                    checked={opaque}
                    onCheckedChange={setOpaque}
                  />
                </div>
              </div>
              {opaque && (
                <ColorField
                  label="Background color"
                  value={background}
                  onChange={setBackground}
                />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Preview</Label>
            <div
              className={cn(
                "bg-checkerboard border-border relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border",
              )}
            >
              {preview.url ? (
                <img
                  src={preview.url}
                  alt=""
                  className={cn(
                    "max-h-full max-w-full transition-opacity",
                    preview.pending && "opacity-50",
                  )}
                />
              ) : preview.error ? (
                <p className="text-destructive p-3 text-center text-xs">
                  {preview.error}
                </p>
              ) : (
                <Spinner className="text-muted-foreground" />
              )}
              {preview.pending && preview.url && (
                <Spinner className="text-muted-foreground absolute right-2 bottom-2 size-4" />
              )}
            </div>
            <p className="text-muted-foreground font-mono text-xs tabular-nums">
              {preview.blob ? formatBytes(preview.blob.size) : "—"}
            </p>
          </div>
        </div>

        <DialogFooter>
          {all.length > 1 && (
            <Button
              variant="outline"
              onClick={() => void downloadAll()}
              disabled={zipping}
            >
              {zipping ? <Spinner /> : <FolderArchiveIcon />}
              All {all.length} as ZIP
            </Button>
          )}
          <Button onClick={() => void download()} disabled={!current}>
            <DownloadIcon />
            Download {meta.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function clampSide(n: number) {
  return Math.min(Math.max(Number.isFinite(n) ? n : 1, 1), MAX_SIDE);
}

/**
 * Debounced live encode of the current settings. The latest request wins;
 * stale results are dropped and the previous object URL is revoked.
 */
function usePreview(
  source: RasterSource | null,
  options: Parameters<typeof renderRaster>[1],
) {
  const [state, setState] = useState<{
    blob: Blob | null;
    url: string | null;
    pending: boolean;
    error: string | null;
  }>({ blob: null, url: null, pending: false, error: null });
  const seq = useRef(0);

  useEffect(() => {
    if (!source) {
      setState({ blob: null, url: null, pending: false, error: null });
      return;
    }
    const id = ++seq.current;
    setState((prev) => ({ ...prev, pending: true, error: null }));
    const timer = window.setTimeout(async () => {
      try {
        const blob = await renderRaster(source.svg, options);
        if (id !== seq.current) return;
        const url = URL.createObjectURL(blob);
        setState((prev) => {
          if (prev.url) URL.revokeObjectURL(prev.url);
          return { blob, url, pending: false, error: null };
        });
      } catch (err) {
        if (id !== seq.current) return;
        setState((prev) => ({
          ...prev,
          blob: null,
          pending: false,
          error: err instanceof Error ? err.message : "Export failed",
        }));
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [source, options]);

  // Revoke the last URL on unmount.
  useEffect(
    () => () => {
      seq.current++;
      setState((prev) => {
        if (prev.url) URL.revokeObjectURL(prev.url);
        return prev;
      });
    },
    [],
  );

  return state;
}
