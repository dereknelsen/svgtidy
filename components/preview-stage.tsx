"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isTypingTarget } from "@/hooks/use-app-hotkeys";
import { cn } from "@/lib/utils";

export type StageView = { zoom: number; pan: { x: number; y: number } };

export const STAGE_HOME: StageView = { zoom: 1, pan: { x: 0, y: 0 } };
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 16;

/** Figma-style zoom stops for the +/- buttons. */
const ZOOM_STOPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16];

export function nextZoomStop(zoom: number, direction: 1 | -1): number {
  if (direction === 1)
    return ZOOM_STOPS.find((s) => s > zoom + 1e-6) ?? MAX_ZOOM;
  return [...ZOOM_STOPS].reverse().find((s) => s < zoom - 1e-6) ?? MIN_ZOOM;
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Rescale around the container center (pan scales with the view). */
export function zoomTo(view: StageView, zoom: number): StageView {
  const next = clampZoom(zoom);
  const ratio = next / view.zoom;
  return { zoom: next, pan: { x: view.pan.x * ratio, y: view.pan.y * ratio } };
}

export type StageTool = "pan" | "zoom";

/**
 * Whether ⌥/Alt is held. The zoom tool inverts on it (zoom out), and both the
 * stage cursor and the header's tool icon need to agree on that state.
 */
export function useAltHeld(): boolean {
  const [alt, setAlt] = useState(false);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "Alt") setAlt(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === "Alt") setAlt(false);
    };
    // Alt can be released outside the window (⌥-tab, app switch).
    const clear = () => setAlt(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, []);
  return alt;
}

type PreviewStageProps = {
  url: string | undefined;
  alt: string;
  view: StageView;
  onViewChange: (view: StageView) => void;
  /**
   * Persistent mouse tool: "pan" drags without holding space, "zoom" makes
   * clicks zoom in (⌥-click zooms out). null = plain pointer.
   */
  tool?: StageTool | null;
  className?: string;
};

/**
 * The zoomable, pannable preview surface. ⌘/ctrl+scroll (and trackpad pinch)
 * zooms around the cursor; holding space turns the cursor into a grab hand
 * for panning; the persistent tools make those behaviors mouse-only. The
 * transform is translate-then-scale around the center, so zoom math stays in
 * one place (`zoomTo` for center, cursor math inline).
 */
export function PreviewStage({
  url,
  alt,
  view,
  onViewChange,
  tool = null,
  className,
}: PreviewStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragFrom = useRef<{ x: number; y: number } | null>(null);

  // Refs mirror the latest values so the native wheel listener (which must be
  // non-passive — React's root wheel handler can't preventDefault) stays
  // attached once.
  const viewRef = useRef(view);
  const onViewChangeRef = useRef(onViewChange);
  useEffect(() => {
    viewRef.current = view;
    onViewChangeRef.current = onViewChange;
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      // ctrlKey also covers trackpad pinch, which browsers report as
      // ctrl+wheel — exactly the gesture users expect to zoom.
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      const { zoom, pan } = viewRef.current;
      const next = clampZoom(zoom * Math.exp(-event.deltaY * 0.01));
      if (next === zoom) return;
      const rect = el.getBoundingClientRect();
      const px = event.clientX - rect.left - rect.width / 2;
      const py = event.clientY - rect.top - rect.height / 2;
      const ratio = next / zoom;
      onViewChangeRef.current({
        zoom: next,
        pan: {
          x: px - (px - pan.x) * ratio,
          y: py - (py - pan.y) * ratio,
        },
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Space = pan mode, held. Global so it works without focusing the stage.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault(); // keep the page from scrolling
      setSpaceHeld(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      setSpaceHeld(false);
      setDragging(false);
      dragFrom.current = null;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const panActive = spaceHeld || tool === "pan";
  const altHeld = useAltHeld();

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Middle-mouse drag always pans, whatever the active tool.
      const middle = event.button === 1;
      if (!panActive && !middle) return;
      event.preventDefault(); // middle: suppress browser autoscroll
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // The pointer can be gone already (pen/touch lifted mid-gesture);
        // the drag still works, just without capture.
      }
      dragFrom.current = { x: event.clientX, y: event.clientY };
      setDragging(true);
    },
    [panActive],
  );

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    const from = dragFrom.current;
    if (!from) return;
    const { zoom, pan } = viewRef.current;
    dragFrom.current = { x: event.clientX, y: event.clientY };
    onViewChangeRef.current({
      zoom,
      pan: {
        x: pan.x + (event.clientX - from.x),
        y: pan.y + (event.clientY - from.y),
      },
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragFrom.current = null;
    setDragging(false);
  }, []);

  // Zoom tool: click steps in at the cursor, ⌥-click steps out.
  const onClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (tool !== "zoom" || panActive) return;
      const { zoom, pan } = viewRef.current;
      const next = clampZoom(nextZoomStop(zoom, event.altKey ? -1 : 1));
      if (next === zoom) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const px = event.clientX - rect.left - rect.width / 2;
      const py = event.clientY - rect.top - rect.height / 2;
      const ratio = next / zoom;
      onViewChangeRef.current({
        zoom: next,
        pan: { x: px - (px - pan.x) * ratio, y: py - (py - pan.y) * ratio },
      });
    },
    [tool, panActive],
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "bg-checkerboard relative h-full touch-none overflow-hidden",
        dragging
          ? "cursor-grabbing"
          : panActive
            ? "cursor-grab"
            : tool === "zoom" &&
              (altHeld ? "cursor-zoom-out" : "cursor-zoom-in"),
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
    >
      <div className="flex h-full items-center justify-center p-8">
        {url && (
          <img
            src={url}
            alt={alt}
            draggable={false}
            className="max-h-full max-w-full select-none"
            style={{
              transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})`,
            }}
          />
        )}
      </div>
    </div>
  );
}
