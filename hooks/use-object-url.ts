"use client";

import { useEffect, useState } from "react";
import { ensureSvgXmlns } from "@/lib/svg";

/**
 * Object URL for a string of SVG markup, revoked automatically when the markup
 * changes or the component unmounts. Object URLs are O(1) to hand to an <img>,
 * unlike data URIs which re-encode the entire document into an attribute
 * string on every render.
 */
export function useSvgObjectUrl(svg: string | null | undefined) {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!svg) {
      // Resource lifecycle (create URL + revoke on cleanup) has to live in an
      // effect; the extra render this setState causes is inherent to that.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(undefined);
      return;
    }
    // Optimized output may legally lack xmlns (the removeXMLNS setting), but
    // a browser won't render a namespace-less SVG document, so reinstate it for
    // the preview only; downloads and copies keep the real output.
    const next = URL.createObjectURL(
      new Blob([ensureSvgXmlns(svg)], { type: "image/svg+xml" }),
    );
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [svg]);

  return url;
}
