export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh w-full">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-linear-to-br from-primary to-chart-3 p-10 text-primary-foreground md:flex">
        <div className="text-xl font-semibold">Hubi Time</div>
        <div className="space-y-2">
          <p className="text-2xl font-semibold">Controle sua jornada e seu banco de horas com clareza.</p>
          <p className="text-sm text-primary-foreground/80">
            Registro de ponto, banco de horas e financeiro pessoal em um so lugar.
          </p>
        </div>
      </div>
      <div className="flex w-full flex-1 items-center justify-center bg-background p-6 md:w-1/2">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
