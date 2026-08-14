import { cn } from "@/lib/utils";

/**
 * Text wordmark, standing in as the logo until SVGtidy gets a drawn mark.
 * "tidy" carries the brand accent (the same green that marks savings).
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-semibold tracking-tight", className)}>
      SVG<span className="text-success">tidy</span>
    </span>
  );
}
