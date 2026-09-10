/**
 * Umami event tracking. Clickable elements get `data-umami-event` attributes
 * (spread `umamiEvent(...)`), which the tracker script picks up on its own;
 * programmatic actions (hotkeys, drops, menu-driven file actions) call
 * `track` directly. Everything is a no-op when the script isn't loaded, so
 * local dev and blocked trackers cost nothing.
 *
 * Event names are kebab-case verbs-first ("download-file"); data values are
 * short strings or numbers, never file contents or user-typed names.
 */

export type EventData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: { track: (event: string, data?: EventData) => void };
  }
}

export function track(event: string, data?: EventData): void {
  if (typeof window === "undefined") return;
  try {
    window.umami?.track(event, data);
  } catch {
    // Analytics must never break the app.
  }
}

const timers = new Map<string, number>();

/**
 * Trailing-debounced `track`, keyed so a slider drag or a typed color lands
 * as one event with its final value.
 */
export function trackDebounced(
  key: string,
  event: string,
  data?: EventData,
  ms = 600,
): void {
  if (typeof window === "undefined") return;
  const prev = timers.get(key);
  if (prev != null) window.clearTimeout(prev);
  timers.set(
    key,
    window.setTimeout(() => {
      timers.delete(key);
      track(event, data);
    }, ms),
  );
}

/** Data attributes for an element whose click is the event. */
export function umamiEvent(
  event: string,
  data?: EventData,
): Record<string, string> {
  const attrs: Record<string, string> = { "data-umami-event": event };
  for (const [key, value] of Object.entries(data ?? {})) {
    attrs[`data-umami-event-${key}`] = String(value);
  }
  return attrs;
}
