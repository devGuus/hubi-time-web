/** Card de download do aplicativo Android (APK servido de /public/downloads). */
import { Download, ShieldCheck, Smartphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const ANDROID_APK_PATH = "/downloads/hubi-time.apk";
const APP_VERSION = "1.0.0";

export function AndroidAppCard() {
  return (
    <Card className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-primary/15 blur-3xl"
      />
      <CardContent className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/downloads/hubi-time-icon.png"
          alt="Ícone do aplicativo Hubi Time"
          width={72}
          height={72}
          className="size-[72px] shrink-0 rounded-2xl shadow-md ring-1 ring-foreground/10"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">Aplicativo Hubi Time</h2>
            <Badge variant="secondary" className="gap-1">
              <Smartphone className="size-3" /> Somente Android
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Registre entrada, almoço e saída com um toque. Usa a mesma conta e os mesmos dados do site.
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0" />
            Versão {APP_VERSION}. Ao instalar, o Android pode pedir para permitir &quot;instalar apps desconhecidos&quot;
            para o seu navegador.
          </p>
        </div>
        <Button size="lg" className="h-10 shrink-0 gap-2 px-4" render={<a href={ANDROID_APK_PATH} download />}>
          <Download className="size-4" />
          Baixar APK
        </Button>
      </CardContent>
    </Card>
  );
}
