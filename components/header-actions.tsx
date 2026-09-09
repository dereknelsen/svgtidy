"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  FolderArchiveIcon,
  ImageIcon,
  ShapesIcon,
  SquareDashedIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { copyText, downloadFile } from "@/lib/download";
import { FILE_TYPE_OPTIONS, type FileType } from "@/lib/format-settings";
import type { FormattedFile } from "@/lib/format-output";
import { RASTER_FORMATS, type RasterFormat } from "@/lib/raster";

type HeaderActionsProps = {
  /** The selected file's export projection; null while nothing is selected. */
  formatted: FormattedFile | null;
  /** The selected file as a bare data URI, honoring the CSS encoding settings. */
  dataUri: string | null;
  /** The selected file's CSS snippet: what the CSS file type would produce. */
  css: string | null;
  fileType: FileType;
  fileCount: number;
  onDownloadZip: () => void;
  onDownloadSprite: () => void;
  /** Opens the raster export dialog on the given format. */
  onExportImage: (format: RasterFormat) => void;
  onGenerateFavicons: () => void;
};

/**
 * The header's export group, iconify-style: [Copy][Download][⌄]. Copy and
 * Download act on the selected file in the selected file type; the menu holds
 * the batch and alternate-format actions.
 */
export function HeaderActions({
  formatted,
  dataUri,
  css,
  fileType,
  fileCount,
  onDownloadZip,
  onDownloadSprite,
  onExportImage,
  onGenerateFavicons,
}: HeaderActionsProps) {
  const [copied, setCopied] = useState(false);
  const typeLabel =
    FILE_TYPE_OPTIONS.find((o) => o.value === fileType)?.label ?? "SVG";

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async (text: string, label: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      toast.success(`Copied ${label}`);
    } else {
      toast.error("Couldn't copy to clipboard");
    }
  };

  return (
    <ButtonGroup>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              disabled={!formatted}
              onClick={() => formatted && copy(formatted.content, typeLabel)}
            >
              {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
              <span className="hidden lg:inline-flex">Copy</span>
            </Button>
          }
        />
        <TooltipContent>Copy as {typeLabel}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              disabled={!formatted}
              onClick={() =>
                formatted &&
                downloadFile(
                  formatted.filename,
                  formatted.content,
                  formatted.mime,
                )
              }
            >
              <DownloadIcon />
              <span className="hidden lg:inline-flex">Download</span>
            </Button>
          }
        />
        <TooltipContent>Download {typeLabel} ⌘S</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="More export options"
              disabled={!formatted && fileCount === 0}
            >
              <ChevronDownIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={fileCount === 0} onClick={onDownloadZip}>
            <FolderArchiveIcon />
            Download all as ZIP
          </DropdownMenuItem>
          {fileType === "symbol" && (
            <DropdownMenuItem
              disabled={fileCount === 0}
              onClick={onDownloadSprite}
            >
              <ShapesIcon />
              Download sprite
              <DropdownMenuShortcut>{fileCount} files</DropdownMenuShortcut>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={!formatted}>
              <ImageIcon />
              Export as image
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {RASTER_FORMATS.map((f) => (
                <DropdownMenuItem
                  key={f.value}
                  onClick={() => onExportImage(f.value)}
                >
                  {f.label}…
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem disabled={!formatted} onClick={onGenerateFavicons}>
            <SquareDashedIcon />
            Generate favicons…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!dataUri}
            onClick={() => dataUri && copy(dataUri, "data URI")}
          >
            Copy data URI
          </DropdownMenuItem>
          {/* When CSS is the file type, the main Copy already does this. */}
          {fileType !== "css" && (
            <DropdownMenuItem
              disabled={!css}
              onClick={() => css && copy(css, "CSS")}
            >
              Copy as CSS
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}
