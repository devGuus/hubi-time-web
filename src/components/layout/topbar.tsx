"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useState } from "react";
import { Menu, Moon, Sun } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { avatarGradient } from "@/lib/avatar-color";
import { SidebarNav } from "@/components/layout/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Topbar() {
  const { user, profile, updateSettings } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  async function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      await updateSettings({ theme: next });
    } catch {
      // preferencia de tema ainda aplica localmente mesmo se a persistencia falhar
    }
  }

  const displayName = profile?.name || user?.email || "";

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 sm:px-6">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
              <Menu className="size-5" />
            </Button>
          }
        />
        <SheetContent side="left" className="flex flex-col bg-sidebar p-4 text-sidebar-foreground">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 items-center justify-end gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Alternar tema">
          <span key={theme} className="animate-in zoom-in-50 duration-200">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </span>
        </Button>

        <Button
          variant="ghost"
          className="gap-2 px-2"
          render={
            <Link href="/perfil" aria-label="Abrir perfil do usuário">
              <Avatar className="size-7">
                <AvatarFallback
                  className="text-xs text-white"
                  style={{ background: avatarGradient(displayName || "?") }}
                >
                  {initialsOf(displayName || "?")}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm sm:inline">{displayName}</span>
            </Link>
          }
        />
      </div>
    </header>
  );
}
