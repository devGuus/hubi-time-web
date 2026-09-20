"use client";

/**
 * Campo de horario com botao "Agora". Usa <input type="time"> nativo, que
 * ja suporta valor vazio (NULL) e formato HH:MM sem mascara customizada.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TimeFieldProps {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  error?: boolean;
}

export function TimeField({ label, value, onChange, disabled, error }: TimeFieldProps) {
  function setNow() {
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, "0");
    const mm = now.getMinutes().toString().padStart(2, "0");
    onChange(`${hh}:${mm}`);
  }

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
        <span
          className={`size-1.5 rounded-full transition-colors ${value ? "bg-success" : "bg-muted-foreground/30"}`}
        />
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          type="time"
          className={`w-32 ${error ? "border-destructive" : ""}`}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
        />
        <Button type="button" variant="ghost" size="sm" onClick={setNow} disabled={disabled}>
          Agora
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="animate-in fade-in duration-150"
            onClick={() => onChange(null)}
            disabled={disabled}
          >
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
