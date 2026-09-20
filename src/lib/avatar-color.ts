/** Gera um gradiente determinístico (mesmo nome = mesma cor sempre) para avatares sem foto. */
export function avatarGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, oklch(0.6 0.16 ${hue}), oklch(0.5 0.18 ${(hue + 40) % 360}))`;
}
