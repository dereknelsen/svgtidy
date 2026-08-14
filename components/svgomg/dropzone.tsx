"use client";

import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { UploadCloudIcon, FileWarningIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { byteLength } from "@/lib/format";

export type IncomingSvg = { name: string; svg: string; size: number };

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per file is plenty for vectors.

async function readFiles(files: File[]): Promise<IncomingSvg[]> {
  const results: IncomingSvg[] = [];
  for (const file of files) {
    const text = await file.text();
    if (!text.includes("<svg")) {
      toast.error(`"${file.name}" doesn't look like an SVG`, {
        description: "No <svg> element found in the file.",
      });
      continue;
    }
    results.push({ name: file.name, svg: text, size: byteLength(text) });
  }
  return results;
}

type DropzoneProps = {
  onFiles: (files: IncomingSvg[]) => void;
  variant?: "hero" | "compact";
  className?: string;
};

export function Dropzone({ onFiles, variant = "hero", className }: DropzoneProps) {
  const onDrop = useCallback(
    async (accepted: File[], rejected: FileRejection[]) => {
      for (const r of rejected) {
        if (r.errors.some((e) => e.code === "file-too-large")) {
          toast.error(`"${r.file.name}" is too large`, { description: "Files must be under 8 MB." });
        } else {
          toast.error(`Couldn't add "${r.file.name}"`, { description: "Only SVG files are supported." });
        }
      }
      if (accepted.length === 0) return;
      const parsed = await readFiles(accepted);
      if (parsed.length > 0) onFiles(parsed);
    },
    [onFiles],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "image/svg+xml": [".svg"] },
    maxSize: MAX_BYTES,
    multiple: true,
    noClick: variant === "hero" ? false : true,
    noKeyboard: variant === "compact",
  });

  if (variant === "compact") {
    return (
      <div className={className}>
        <input {...getInputProps()} />
        <button
          type="button"
          onClick={open}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
        >
          <UploadCloudIcon className="size-4" />
          Add more SVGs
        </button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card px-8 py-20 text-center transition-colors",
        "hover:border-ring/70 focus-visible:border-ring focus-visible:outline-none",
        isDragActive && "border-success bg-success/5",
        className,
      )}
    >
      <input {...getInputProps()} />
      <div
        className={cn(
          "mb-6 flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground transition-colors",
          isDragActive && "bg-success/15 text-success",
        )}
      >
        <UploadCloudIcon className="size-8" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-balance">
        {isDragActive ? "Drop to optimize" : "Drop SVGs to optimize"}
      </h2>
      <p className="mt-2 max-w-sm text-pretty text-sm text-muted-foreground">
        Drag in one file or a whole folder. Everything is processed on your device — nothing is
        uploaded.
      </p>
      <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileWarningIcon className="size-3.5" />
        SVG only, up to 8 MB each
      </p>
    </div>
  );
}
