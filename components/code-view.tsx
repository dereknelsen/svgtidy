"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import type * as MonacoNS from "monaco-editor";
import {
  isMobileBrowser,
  loadMonaco,
  monacoThemeName,
  monoFontFamily,
  READ_ONLY_OPTIONS,
} from "@/lib/monaco";
import type { CodeLanguage } from "@/lib/format-output";
import { cn } from "@/lib/utils";

export function useIsMobile() {
  const [mobile] = useState(() => isMobileBrowser());
  return mobile;
}

export function PlainCode({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <pre
      className={cn(
        "bg-muted/40 h-full overflow-auto p-4 text-xs leading-relaxed",
        className,
      )}
    >
      <code>{value}</code>
    </pre>
  );
}

/**
 * Chrome warns that Monaco's internal textareas (IME buffer, hidden input)
 * lack an id/name, and Monaco exposes no option for them, so name them
 * after the editor mounts.
 */
function nameMonacoInputs(container: HTMLElement | null) {
  container
    ?.querySelectorAll<HTMLTextAreaElement>("textarea:not([name])")
    .forEach((el) => {
      el.name = "monaco-editor-input";
    });
}

/** Keeps the global Monaco theme in sync with next-themes. */
function useMonacoTheme(ready: boolean) {
  const { resolvedTheme } = useTheme();
  const themeRef = useRef(resolvedTheme);

  useEffect(() => {
    themeRef.current = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    if (!ready) return;
    void loadMonaco().then((monaco) =>
      monaco.editor.setTheme(monacoThemeName(resolvedTheme)),
    );
  }, [resolvedTheme, ready]);

  return themeRef;
}

/**
 * Read-only Monaco viewer for SVG markup. Falls back to a plain <code> block
 * on mobile browsers (Monaco doesn't support them) and while the editor chunk
 * loads, so content is always visible immediately.
 */
export function CodeView({
  value,
  language = "xml",
}: {
  value: string;
  language?: CodeLanguage;
}) {
  const mobile = useIsMobile();
  if (mobile) return <PlainCode value={value} />;
  // Keyed so a language change recreates the editor with the right grammar.
  return <MonacoCode key={language} value={value} language={language} />;
}

function MonacoCode({
  value,
  language,
}: {
  value: string;
  language: CodeLanguage;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoNS.editor.IStandaloneCodeEditor | null>(null);
  const [ready, setReady] = useState(false);
  const themeRef = useMonacoTheme(ready);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    void loadMonaco().then((monaco) => {
      if (cancelled || !containerRef.current) return;
      editorRef.current = monaco.editor.create(containerRef.current, {
        ...READ_ONLY_OPTIONS,
        value: valueRef.current,
        language,
        theme: monacoThemeName(themeRef.current),
        fontFamily: monoFontFamily(),
      });
      nameMonacoInputs(containerRef.current);
      setReady(true);
    });
    return () => {
      cancelled = true;
      const editor = editorRef.current;
      editorRef.current = null;
      editor?.getModel()?.dispose();
      editor?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.getValue() !== value) editor.setValue(value);
  }, [value, ready]);

  return (
    <div className="relative h-full">
      <div ref={containerRef} className="h-full" />
      {!ready && <PlainCode value={value} className="absolute inset-0" />}
    </div>
  );
}

type MonacoDiffProps = {
  original: string;
  modified: string;
};

/** Read-only side-by-side Monaco diff (inline when space is tight). */
export function MonacoDiff({ original, modified }: MonacoDiffProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoNS.editor.IStandaloneDiffEditor | null>(null);
  const [ready, setReady] = useState(false);
  const themeRef = useMonacoTheme(ready);
  const contentRef = useRef({ original, modified });

  useEffect(() => {
    contentRef.current = { original, modified };
  }, [original, modified]);

  useEffect(() => {
    let cancelled = false;
    void loadMonaco().then((monaco) => {
      if (cancelled || !containerRef.current) return;
      const editor = monaco.editor.createDiffEditor(containerRef.current, {
        ...READ_ONLY_OPTIONS,
        theme: monacoThemeName(themeRef.current),
        fontFamily: monoFontFamily(),
        renderSideBySide: true,
        useInlineViewWhenSpaceIsLimited: true,
        hideUnchangedRegions: { enabled: true },
        renderOverviewRuler: false,
        originalEditable: false,
        diffWordWrap: "on",
        enableSplitViewResizing: false,
      });
      editor.setModel({
        original: monaco.editor.createModel(contentRef.current.original, "xml"),
        modified: monaco.editor.createModel(contentRef.current.modified, "xml"),
      });
      editorRef.current = editor;
      nameMonacoInputs(containerRef.current);
      setReady(true);
    });
    return () => {
      cancelled = true;
      const editor = editorRef.current;
      editorRef.current = null;
      if (editor) {
        const model = editor.getModel();
        editor.dispose();
        model?.original.dispose();
        model?.modified.dispose();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (!model) return;
    if (model.original.getValue() !== original)
      model.original.setValue(original);
    if (model.modified.getValue() !== modified)
      model.modified.setValue(modified);
  }, [original, modified, ready]);

  return <div ref={containerRef} className="h-full" />;
}
