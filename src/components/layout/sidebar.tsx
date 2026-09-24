"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import {
  BarChart3,
  Calendar,
  FileText,
  History,
  Home,
  PiggyBank,
  Settings,
  Upload,
  User,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/hoje", label: "Hoje", icon: Home },
  { href: "/calendario", label: "Calendario", icon: Calendar },
  { href: "/historico", label: "Historico", icon: History },
  { href: "/controle-horas", label: "Controle de Horas", icon: BarChart3 },
  { href: "/banco-horas", label: "Banco de Horas", icon: PiggyBank },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/relatorios", label: "Relatorios", icon: FileText },
  { href: "/importar", label: "Importar", icon: Upload },
  { href: "/configuracoes", label: "Configuracoes", icon: Settings },
  { href: "/perfil", label: "Perfil", icon: User },
] as const;

/** Conteudo da navegacao, compartilhado entre a sidebar fixa (desktop) e a gaveta (mobile). */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const activeIndex = NAV_ITEMS.findIndex(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`)
  );

  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const item = itemRefs.current[activeIndex];
    if (!nav || !item) {
      setIndicator(null);
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    setIndicator({ top: itemRect.top - navRect.top, height: itemRect.height });
  }, [activeIndex]);

  return (
    <>
      <div className="mb-6 px-2 text-lg font-semibold bg-linear-to-r from-primary to-chart-3 bg-clip-text text-transparent">
        Hubi Time
      </div>
      <nav ref={navRef} className="relative flex flex-1 flex-col gap-1">
        {indicator && (
          <div
            className="absolute inset-x-0 rounded-md bg-sidebar-primary/10 transition-[top,height] duration-300 ease-out"
            style={{ top: indicator.top, height: indicator.height }}
          />
        )}
        {NAV_ITEMS.map(({ href, label, icon: Icon }, index) => {
          const active = index === activeIndex;
          return (
            <Link
              key={href}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              href={href}
              onClick={onNavigate}
              className={cn(
                "group relative z-10 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4 transition-transform group-hover:scale-110" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/** Sidebar fixa - visivel apenas em telas grandes (lg+). Em telas menores, a navegacao
 * vira uma gaveta (Sheet) acionada pelo botao de menu no Topbar. */
export function Sidebar() {
  return (
    <aside className="hidden h-svh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
      <SidebarNav />
    </aside>
  );
}
