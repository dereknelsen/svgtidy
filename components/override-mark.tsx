"use client";

import { Undo2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * The dot after a setting's label: in workspace scope it means "differs from
 * default"; in folder or file scope it means "pinned here", and the undo
 * button lets the key inherit again.
 */
export function OverrideMark({
  marked,
  onClear,
  label,
}: {
  marked: boolean;
  onClear?: (() => void) | null;
  label: string;
}) {
  if (!marked) return null;
  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle">
      <span
        className="bg-primary/70 inline-block size-1.5 rounded-full"
        aria-label={onClear ? "Overridden here" : "Changed from default"}
      />
      {onClear && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground -my-1.5 size-5"
                aria-label={`Inherit ${label}`}
                onClick={onClear}
              >
                <Undo2Icon className="size-3" />
              </Button>
            }
          />
          <TooltipContent>Inherit from the layer beneath</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}
