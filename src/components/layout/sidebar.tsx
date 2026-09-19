"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Calendar,
  Clock,
  FileText,
  History,
  Home,
  PiggyBank,
  Settings,
  User,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/hoje", label: "Hoje", icon: Home },
  { href: "/registrar", label: "Registrar Horas", icon: Clock },
  { href: "/calendario", label: "Calendario", icon: Calendar },
  { href: "/historico", label: "Historico", icon: History },
  { href: "/controle-horas", label: "Controle de Horas", icon: BarChart3 },
  { href: "/banco-horas", label: "Banco de Horas", icon: PiggyBank },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/relatorios", label: "Relatorios", icon: FileText },
  { href: "/configuracoes", label: "Configuracoes", icon: Settings },
  { href: "/perfil", label: "Perfil", icon: User },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-svh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4">
      <div className="mb-6 px-2 text-lg font-semibold text-sidebar-foreground">Hubi Time</div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary/10 text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
