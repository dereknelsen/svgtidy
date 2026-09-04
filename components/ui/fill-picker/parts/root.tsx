"use client";

import * as React from "react";
import { ColorPickerContext } from "../context";
import {
  useColorPicker,
  type UseColorPickerProps,
} from "../hooks/use-color-picker";
import { cn } from "@/lib/utils";

export interface RootProps
  extends
    UseColorPickerProps,
    Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  /** When true the picker is rendered without children using the default layout. */
  asChild?: boolean;
}

export const Root = React.forwardRef<HTMLDivElement, RootProps>(function Root(
  {
    value,
    defaultValue,
    onValueChange,
    format,
    defaultFormat,
    onFormatChange,
    formats,
    backgroundColor,
    className,
    children,
    ...rest
  },
  ref,
) {
  const state = useColorPicker({
    value,
    defaultValue,
    onValueChange,
    format,
    defaultFormat,
    onFormatChange,
    formats,
    backgroundColor,
  });

  return (
    <ColorPickerContext.Provider value={state}>
      <div
        ref={ref}
        data-slot="color-picker"
        className={cn(
          "border-border bg-popover text-popover-foreground flex w-full max-w-[280px] flex-col gap-2 rounded-lg border p-3 shadow-sm",
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    </ColorPickerContext.Provider>
  );
});
