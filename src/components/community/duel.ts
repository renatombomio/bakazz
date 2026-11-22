export type DuelSide = { id: number; title: string; image: string; color?: string | null };
export type Duel = { a: DuelSide; b: DuelSide };

export const amsterdamDay = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(d);

export function weekKey(d = new Date()): string {
  const [y, m, day] = amsterdamDay(d).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, day));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

export function percents(a: number, b: number): [number, number] {
  const total = a + b;
  if (!total) return [50, 50];
  const pa = Math.round((a / total) * 100);
  return [pa, 100 - pa];
}
