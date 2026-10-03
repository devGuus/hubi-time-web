/** Selo numerado usado para indicar passos de um fluxo (Relatorios, Importar). */
export function StepBadge({ step }: { step: number }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {step}
    </span>
  );
}
