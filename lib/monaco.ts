"use client";

import type * as MonacoNS from "monaco-editor";

export type Monaco = typeof MonacoNS;

/**
 * Monaco's own support matrix excludes mobile browsers, so callers should
 * render a plain <code> fallback when this returns true.
 */
export function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPod|Mobile/i.test(ua)) return true;
  // iPadOS reports itself as Macintosh but exposes multiple touch points.
  return (
    /iPad/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

/** The JetBrains Mono stack from next/font, resolved from the CSS variable. */
export function monoFontFamily(): string {
  if (typeof document === "undefined") return "monospace";
  const stack = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-mono")
    .trim();
  return stack || "monospace";
}

export function monacoThemeName(resolvedTheme: string | undefined): string {
  return resolvedTheme === "dark" ? "svgtidy-dark" : "svgtidy-light";
}

/** Shared options for every read-only Monaco surface in the app. */
export const READ_ONLY_OPTIONS: MonacoNS.editor.IStandaloneEditorConstructionOptions =
  {
    readOnly: true,
    domReadOnly: true,
    minimap: { enabled: false },
    wordWrap: "on",
    folding: false,
    lineNumbersMinChars: 3,
    glyphMargin: false,
    scrollBeyondLastLine: false,
    renderLineHighlight: "none",
    overviewRulerLanes: 0,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    occurrencesHighlight: "off",
    selectionHighlight: false,
    matchBrackets: "never",
    contextmenu: false,
    links: false,
    fontSize: 12,
    lineHeight: 20,
    padding: { top: 12, bottom: 12 },
    scrollbar: {
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
      useShadows: false,
    },
    guides: { indentation: false },
    stickyScroll: { enabled: false },
    automaticLayout: true,
  };

let monacoPromise: Promise<Monaco> | null = null;

/**
 * Lazily load the Monaco editor core plus the XML Monarch grammar (no
 * language-service worker needed for SVG markup). Everything stays out of the
 * main bundle until a code or diff view is actually opened.
 */
export function loadMonaco(): Promise<Monaco> {
  if (!monacoPromise) {
    monacoPromise = (async () => {
      (self as { MonacoEnvironment?: MonacoNS.Environment }).MonacoEnvironment =
        {
          getWorker: () =>
            new Worker(
              // The package's exports map prefixes subpaths with esm/vs/.
              new URL("monaco-editor/editor/editor.worker.js", import.meta.url),
              { type: "module" },
            ),
        };
      const [monaco] = await Promise.all([
        import("monaco-editor/editor/editor.api.js"),
        import("monaco-editor/languages/definitions/xml/register.js"),
      ]);
      defineThemes(monaco as unknown as Monaco);
      return monaco as unknown as Monaco;
    })();
  }
  return monacoPromise;
}

/**
 * Hex approximations of the app's stone + green oklch tokens (Monaco themes
 * can't read CSS variables).
 */
function defineThemes(monaco: Monaco) {
  monaco.editor.defineTheme("svgtidy-light", {
    base: "vs",
    inherit: true,
    // The .xml suffixes are required: the base themes ship xml-specific rules
    // (delimiter.xml, attribute.value.xml, …) that outrank generic tokens.
    rules: [
      { token: "tag.xml", foreground: "1c1917" },
      { token: "delimiter.xml", foreground: "a6a09b" },
      { token: "attribute.name.xml", foreground: "79716b" },
      { token: "attribute.value.xml", foreground: "2a9d64" },
      { token: "string.xml", foreground: "2a9d64" },
      { token: "comment.xml", foreground: "a6a09b" },
      { token: "comment.content.xml", foreground: "a6a09b" },
      { token: "metatag.xml", foreground: "79716b" },
    ],
    colors: {
      "editor.background": "#fafaf9",
      "editor.foreground": "#1c1917",
      "editorLineNumber.foreground": "#c9c4bf",
      "editorLineNumber.activeForeground": "#79716b",
      "editorCursor.foreground": "#1c1917",
      "diffEditor.insertedTextBackground": "#2a9d6426",
      "diffEditor.removedTextBackground": "#dc262622",
      "diffEditor.insertedLineBackground": "#2a9d6412",
      "diffEditor.removedLineBackground": "#dc262610",
      "diffEditorGutter.insertedLineBackground": "#2a9d6412",
      "diffEditorGutter.removedLineBackground": "#dc262610",
    },
  });

  monaco.editor.defineTheme("svgtidy-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "tag.xml", foreground: "fafaf9" },
      { token: "delimiter.xml", foreground: "6b6560" },
      { token: "attribute.name.xml", foreground: "a6a09b" },
      { token: "attribute.value.xml", foreground: "45b877" },
      { token: "string.xml", foreground: "45b877" },
      { token: "comment.xml", foreground: "6b6560" },
      { token: "comment.content.xml", foreground: "6b6560" },
      { token: "metatag.xml", foreground: "a6a09b" },
    ],
    colors: {
      "editor.background": "#201d1b",
      "editor.foreground": "#fafaf9",
      "editorLineNumber.foreground": "#57534e",
      "editorLineNumber.activeForeground": "#a6a09b",
      "editorCursor.foreground": "#fafaf9",
      "diffEditor.insertedTextBackground": "#45b8772b",
      "diffEditor.removedTextBackground": "#f8717126",
      "diffEditor.insertedLineBackground": "#45b87714",
      "diffEditor.removedLineBackground": "#f8717112",
      "diffEditorGutter.insertedLineBackground": "#45b87714",
      "diffEditorGutter.removedLineBackground": "#f8717112",
    },
  });
}
