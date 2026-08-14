"use client";

import { useCallback, useRef, useState } from "react";
import { ChevronsLeftRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type CompareSliderProps = {
  originalUrl: string | undefined;
  optimizedUrl: string | undefined;
  originalLabel: string;
  optimizedLabel: string;
  alt: string;
  className?: string;
};

/**
 * Draggable before/after comparison over the preview. The original render sits
 * on the left of the divider, the optimized output on the right, so sliding
 * right reveals more of the original. Position updates track the pointer 1:1
 * with no easing — direct manipulation shouldn't lag its input.
 */
export function CompareSlider({
  originalUrl,
  optimizedUrl,
  originalLabel,
  optimizedLabel,
  alt,
  className,
}: CompareSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);

  const positionFromPointer = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, pct)));
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      positionFromPointer(event.clientX);
    },
    [positionFromPointer],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      positionFromPointer(event.clientX);
    },
    [positionFromPointer],
  );

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    const step = (delta: number) => {
      event.preventDefault();
      setPosition((prev) => Math.min(100, Math.max(0, prev + delta)));
    };
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") step(-5);
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") step(5);
    else if (event.key === "Home") {
      event.preventDefault();
      setPosition(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setPosition(100);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      className={cn(
        "bg-checkerboard relative h-full touch-none overflow-hidden select-none",
        className,
      )}
    >
      <div className="absolute inset-0 grid place-items-center p-8">
        {optimizedUrl && (
          <img
            src={optimizedUrl}
            alt={`Optimized ${alt}`}
            className="max-h-full max-w-full"
            draggable={false}
          />
        )}
      </div>
      <div
        className="absolute inset-0 grid place-items-center p-8"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        {originalUrl && (
          <img
            src={originalUrl}
            alt={`Original ${alt}`}
            className="max-h-full max-w-full"
            draggable={false}
          />
        )}
      </div>

      <span className="border-border bg-background/85 text-muted-foreground pointer-events-none absolute top-3 left-3 rounded-full border px-2 py-0.5 font-mono text-xs tabular-nums">
        Original · {originalLabel}
      </span>
      <span className="border-border bg-background/85 text-muted-foreground pointer-events-none absolute top-3 right-3 rounded-full border px-2 py-0.5 font-mono text-xs tabular-nums">
        Optimized · {optimizedLabel}
      </span>

      {/* Divider + grabber */}
      <div
        className="bg-foreground/50 pointer-events-none absolute inset-y-0 w-px"
        style={{ left: `${position}%` }}
      />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Comparison position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        onKeyDown={onKeyDown}
        className="border-border bg-background focus-visible:ring-ring/40 absolute top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border shadow-sm transition-shadow outline-none focus-visible:ring-[3px]"
        style={{ left: `${position}%` }}
      >
        <ChevronsLeftRightIcon
          className="text-muted-foreground size-3.5"
          aria-hidden
        />
      </div>
    </div>
  );
}
