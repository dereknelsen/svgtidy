import type { SVGProps } from "react";

/**
 * The app mark: a bezier anchor point with its two control handles — the most
 * characteristic object in the vector-editing world, and the thing this app
 * exists to shrink.
 */
export function WordmarkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* control handle line */}
      <path d="M5 19 L19 5" opacity={0.5} />
      {/* the two control handles */}
      <circle cx="5" cy="19" r="2" fill="currentColor" stroke="none" opacity={0.5} />
      <circle cx="19" cy="5" r="2" fill="currentColor" stroke="none" opacity={0.5} />
      {/* the anchor node */}
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="var(--background)" />
    </svg>
  );
}
