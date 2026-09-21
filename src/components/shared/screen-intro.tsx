"use client";

import { Sparkles, type LucideIcon } from "lucide-react";

import { useFirstVisit } from "@/lib/hooks/use-first-visit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Tip {
  icon: LucideIcon;
  text: string;
}

interface ScreenIntroProps {
  /** Chave unica da tela - usada para lembrar que o tutorial ja foi visto. */
  screenKey: string;
  title: string;
  description: string;
  tips: Tip[];
}

/** Tutorial animado exibido na primeira vez que o usuario abre uma tela. */
export function ScreenIntro({ screenKey, title, description, tips }: ScreenIntroProps) {
  const { show, dismiss } = useFirstVisit(screenKey);

  return (
    <Dialog open={show} onOpenChange={(open) => !open && dismiss()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary animate-in zoom-in-50 duration-300">
            <Sparkles className="size-5" />
          </span>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 py-1">
          {tips.map((tip, index) => (
            <li
              key={index}
              className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-1"
              style={{ animationDelay: `${index * 80}ms`, animationFillMode: "backwards" }}
            >
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <tip.icon className="size-3.5" />
              </span>
              <span className="text-sm text-muted-foreground">{tip.text}</span>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button onClick={dismiss} className="w-full">
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
