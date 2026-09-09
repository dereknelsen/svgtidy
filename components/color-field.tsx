"use client";

import { useId, useState } from "react";
import { useTheme } from "next-themes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ColorPicker,
  isValidColor,
} from "@/components/ui/fill-picker-base/color-picker";
import { cn } from "@/lib/utils";

type ColorFieldProps = {
  label: string;
  description?: string;
  value: string;
  onChange: (css: string) => void;
  className?: string;
};

/**
 * A labeled color input: a swatch that opens the app's color picker, next to
 * a text field that accepts any CSS color. The text field is loose while
 * typing and only commits values that parse.
 */
export function ColorField({
  label,
  description,
  value,
  onChange,
  className,
}: ColorFieldProps) {
  const id = useId();
  const { resolvedTheme } = useTheme();
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger
            aria-label={`Pick ${label.toLowerCase()}`}
            render={
              <button
                type="button"
                className="bg-checkerboard border-border focus-visible:ring-ring/50 size-8 shrink-0 overflow-hidden rounded-lg border outline-none focus-visible:ring-2"
              />
            }
          >
            <span
              className="block size-full"
              style={{ backgroundColor: value }}
            />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-auto border-0 bg-transparent p-0 shadow-none"
          >
            <ColorPicker.Root
              value={value}
              onValueChange={(next, _formatted, formats) =>
                onChange(next.alpha < 1 ? formats.oklch : formats.hex)
              }
              backgroundColor={resolvedTheme === "dark" ? "#201d1b" : "#fafaf9"}
            >
              <ColorPicker.Area mode="oklch-cl" softProof />
              <div className="flex flex-col gap-1.5">
                <ColorPicker.Hue />
                <ColorPicker.Chroma />
                <ColorPicker.Lightness />
                <ColorPicker.Alpha />
              </div>
              <div className="flex items-center gap-2">
                <ColorPicker.FormatSwitcher className="flex-1" />
                <ColorPicker.EyeDropper className="h-8 w-full flex-1" />
              </div>
              <ColorPicker.CssInput />
            </ColorPicker.Root>
          </PopoverContent>
        </Popover>
        <Input
          id={id}
          value={draft ?? value}
          spellCheck={false}
          autoComplete="off"
          className="font-mono"
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            if (isValidColor(next)) onChange(next);
          }}
          onBlur={() => setDraft(null)}
        />
      </div>
      {description && (
        <p className="text-muted-foreground text-xs">{description}</p>
      )}
    </div>
  );
}
