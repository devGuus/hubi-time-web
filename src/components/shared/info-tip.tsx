"use client";

import { Info } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Botão pequeno que explica, por toque/clique, o que uma métrica significa. */
export function InfoTip({ label, text }: { label: string; text: string }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`O que é: ${label}`}
            className="text-muted-foreground/60 transition-colors hover:text-foreground"
          >
            <Info className="size-3.5" />
          </button>
        }
      />
      <PopoverContent className="w-64 text-sm text-foreground">{text}</PopoverContent>
    </Popover>
  );
}
