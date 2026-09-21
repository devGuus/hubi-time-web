"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { LogOut, Menu, Moon, Sun } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { avatarGradient } from "@/lib/avatar-color";
import { SidebarNav } from "@/components/layout/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const router = useRouter();
  const { user, profile, signOut, updateSettings } = useAuth();
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

  async function handleSignOut() {
    await signOut();
    router.push("/login");
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
          <SheetTitle className="sr-only">Menu de navegacao</SheetTitle>
          <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 items-center justify-end gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Alternar tema">
          <span key={theme} className="animate-in zoom-in-50 duration-200">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="gap-2 px-2">
                <Avatar className="size-7">
                  <AvatarFallback
                    className="text-xs text-white"
                    style={{ background: avatarGradient(displayName || "?") }}
                  >
                    {initialsOf(displayName || "?")}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm sm:inline">{displayName}</span>
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 size-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
