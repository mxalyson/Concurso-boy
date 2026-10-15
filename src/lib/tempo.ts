/** Fuso usado para "hoje", sequências e metas diárias (Brasília, sem horário de verão). */
export const FUSO_HORAS = Number(process.env.FUSO_HORAS ?? -3);

/** Data local de hoje (YYYY-MM-DD), opcionalmente deslocada em dias. */
export function hoje(deslocamentoDias = 0): string {
  const ms = Date.now() + FUSO_HORAS * 3600_000 + deslocamentoDias * 86400_000;
  return new Date(ms).toISOString().slice(0, 10);
}
