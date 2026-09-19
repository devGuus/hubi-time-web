/**
 * O proxy (src/proxy.ts) sempre redireciona "/" para /hoje ou /login antes
 * de chegar aqui. Este fallback so aparece em cenarios de borda (proxy nao
 * executado ainda).
 */
export default function RootPage() {
  return null;
}
